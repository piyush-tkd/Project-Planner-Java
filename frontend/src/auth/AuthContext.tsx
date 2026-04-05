import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import apiClient from '../api/client';
import { onAuthExpired } from './authEvents';

interface AuthState {
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY        = 'pp_token';
const USER_KEY         = 'pp_username';
const DISPLAY_KEY      = 'pp_display_name';
const ROLE_KEY         = 'pp_role';
const PAGES_KEY        = 'pp_pages';

function loadPages(): string[] | null {
  const raw = localStorage.getItem(PAGES_KEY);
  if (raw === null) return null;
  if (raw === 'null') return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    token:        localStorage.getItem(TOKEN_KEY),
    username:     localStorage.getItem(USER_KEY),
    displayName:  localStorage.getItem(DISPLAY_KEY),
    role:         localStorage.getItem(ROLE_KEY),
    allowedPages: loadPages(),
  });

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await apiClient.post<{
      token: string;
      username: string;
      displayName: string | null;
      role: string;
      allowedPages: string[] | null;
    }>('/auth/login', { username, password });

    localStorage.setItem(TOKEN_KEY,   data.token);
    localStorage.setItem(USER_KEY,    data.username);
    localStorage.setItem(DISPLAY_KEY, data.displayName ?? '');
    localStorage.setItem(ROLE_KEY,    data.role);
    localStorage.setItem(PAGES_KEY,   JSON.stringify(data.allowedPages));

    setAuth({
      token:        data.token,
      username:     data.username,
      displayName:  data.displayName,
      role:         data.role,
      allowedPages: data.allowedPages,
    });
  }, []);

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
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
  }, []);

  const logout = useCallback(() => {
    apiClient.post('/auth/logout').catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(DISPLAY_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(PAGES_KEY);
    setAuth({ token: null, username: null, displayName: null, role: null, allowedPages: null });
  }, []);

  // Auto-logout when a 401 is received (JWT expired or invalid)
  useEffect(() => onAuthExpired(logout), [logout]);

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
