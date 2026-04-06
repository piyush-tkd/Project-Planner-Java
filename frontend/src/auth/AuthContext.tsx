import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { onAuthExpired } from './authEvents';

interface AuthState {
  /**
   * In-memory authentication marker.
   * - Set to the JWT string immediately after a successful login (response body).
   * - Set to '__cookie__' after a successful cookie bootstrap on page refresh.
   * - null  → not authenticated.
   *
   * The actual JWT is no longer stored in localStorage; the browser's HttpOnly
   * cookie carries it automatically on every request (Prompt 1.9 / 1.10).
   */
  token: string | null;
  username: string | null;
  /** Display name set by admin; may be null if not configured. */
  displayName: string | null;
  role: string | null;
  /** null = all pages allowed (ADMIN); string[] = restricted set of page keys */
  allowedPages: string[] | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /** Re-fetches /auth/me and refreshes the stored auth state (e.g. after display name change). */
  refreshMe: () => Promise<void>;
  isAuthenticated: boolean;
  /** true for ADMIN and SUPER_ADMIN */
  isAdmin: boolean;
  /** true only for SUPER_ADMIN — bypasses every permission check */
  isSuperAdmin: boolean;
  canAccess: (pageKey: string) => boolean;
  /** Convenience: displayName if set, otherwise username */
  displayLabel: string | null;
  /** true while the initial /auth/me cookie-bootstrap check is in-flight */
  initialising: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Only non-sensitive fields survive a page refresh via localStorage.
// The JWT itself is no longer stored here — it lives in the HttpOnly cookie.
const USER_KEY    = 'pp_username';
const DISPLAY_KEY = 'pp_display_name';
const ROLE_KEY    = 'pp_role';
const PAGES_KEY   = 'pp_pages';

function loadPages(): string[] | null {
  const raw = localStorage.getItem(PAGES_KEY);
  if (raw === null) return null;
  if (raw === 'null') return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  // On first render we don't yet know if the cookie is still valid.
  // We'll set initialising=false once the bootstrap check completes.
  const hasStoredSession = !!localStorage.getItem(USER_KEY);

  const [auth, setAuth] = useState<AuthState>({
    token:        null,   // never read from localStorage — populated by login or bootstrap
    username:     localStorage.getItem(USER_KEY),
    displayName:  localStorage.getItem(DISPLAY_KEY),
    role:         localStorage.getItem(ROLE_KEY),
    allowedPages: loadPages(),
  });

  const [initialising, setInitialising] = useState(hasStoredSession);

  // ── Cookie bootstrap ──────────────────────────────────────────────────────
  // On page refresh, if localStorage says the user had a session, validate the
  // HttpOnly cookie by calling /auth/me.  If it succeeds we restore the token
  // marker; if it fails (expired / cleared) we wipe localStorage and go to login.
  useEffect(() => {
    if (!hasStoredSession) return;

    apiClient.get<{
      username: string;
      displayName: string | null;
      role: string;
      allowedPages: string[] | null;
    }>('/auth/me')
      .then(({ data }) => {
        localStorage.setItem(USER_KEY,    data.username);
        localStorage.setItem(DISPLAY_KEY, data.displayName ?? '');
        localStorage.setItem(ROLE_KEY,    data.role);
        localStorage.setItem(PAGES_KEY,   JSON.stringify(data.allowedPages));
        setAuth({
          token:        '__cookie__',   // truthy sentinel — actual JWT is in the HttpOnly cookie
          username:     data.username,
          displayName:  data.displayName,
          role:         data.role,
          allowedPages: data.allowedPages,
        });
      })
      .catch(() => {
        // Cookie is missing or expired — clear stale localStorage and go to login
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(DISPLAY_KEY);
        localStorage.removeItem(ROLE_KEY);
        localStorage.removeItem(PAGES_KEY);
        setAuth({ token: null, username: null, displayName: null, role: null, allowedPages: null });
      })
      .finally(() => setInitialising(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);   // run once on mount only

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (username: string, password: string) => {
    const { data } = await apiClient.post<{
      token: string;
      username: string;
      displayName: string | null;
      role: string;
      allowedPages: string[] | null;
    }>('/auth/login', { username, password });

    // Persist only non-sensitive profile fields — the JWT stays in the HttpOnly cookie.
    localStorage.setItem(USER_KEY,    data.username);
    localStorage.setItem(DISPLAY_KEY, data.displayName ?? '');
    localStorage.setItem(ROLE_KEY,    data.role);
    localStorage.setItem(PAGES_KEY,   JSON.stringify(data.allowedPages));

    setAuth({
      token:        data.token,   // keep in-memory for this tab session
      username:     data.username,
      displayName:  data.displayName,
      role:         data.role,
      allowedPages: data.allowedPages,
    });
  }, []);

  // ── Refresh /auth/me ──────────────────────────────────────────────────────
  const refreshMe = useCallback(async () => {
    if (!auth.username) return;
    const { data } = await apiClient.get<{
      username: string;
      displayName: string | null;
      role: string;
      allowedPages: string[] | null;
    }>('/auth/me');
    localStorage.setItem(DISPLAY_KEY, data.displayName ?? '');
    localStorage.setItem(ROLE_KEY,    data.role);
    localStorage.setItem(PAGES_KEY,   JSON.stringify(data.allowedPages));
    setAuth(prev => ({
      ...prev,
      displayName:  data.displayName,
      role:         data.role,
      allowedPages: data.allowedPages,
    }));
  }, [auth.username]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    // Ask the backend to clear the HttpOnly cookie (Set-Cookie: access_token=; Max-Age=0)
    apiClient.post('/auth/logout').catch(() => {});
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(DISPLAY_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(PAGES_KEY);
    setAuth({ token: null, username: null, displayName: null, role: null, allowedPages: null });
  }, []);

  // Auto-logout + redirect when a 401 is received (JWT expired or cookie missing)
  useEffect(() => onAuthExpired(() => {
    logout();
    navigate('/login', { state: { expired: true }, replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [logout]);

  const isSuperAdmin = auth.role === 'SUPER_ADMIN';
  const isAdmin = auth.role === 'ADMIN' || isSuperAdmin;

  const canAccess = useCallback(
    (pageKey: string) => {
      if (!auth.token) return false;
      // SUPER_ADMIN and ADMIN bypass all page permission checks
      if (isAdmin) return true;
      if (auth.allowedPages === null) return true;
      return auth.allowedPages.includes(pageKey);
    },
    [auth.token, auth.allowedPages, isAdmin],
  );

  const displayLabel = auth.displayName || auth.username;

  return (
    <AuthContext.Provider value={{
      ...auth,
      isAuthenticated: !!auth.token,
      isAdmin,
      isSuperAdmin,
      canAccess,
      displayLabel,
      login,
      logout,
      refreshMe,
      initialising,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Must be used inside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
