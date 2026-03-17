import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import apiClient from '../api/client';

interface AuthState {
  token: string | null;
  username: string | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'pp_token';
const USER_KEY  = 'pp_username';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    token:    localStorage.getItem(TOKEN_KEY),
    username: localStorage.getItem(USER_KEY),
  });

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await apiClient.post<{ token: string; username: string }>(
      '/auth/login',
      { username, password },
    );
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY,  data.username);
    setAuth({ token: data.token, username: data.username });
  }, []);

  const logout = useCallback(() => {
    // Fire-and-forget — backend is stateless, just discard the token locally
    apiClient.post('/auth/logout').catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuth({ token: null, username: null });
  }, []);

  return (
    <AuthContext.Provider value={{
      ...auth,
      isAuthenticated: !!auth.token,
      login,
      logout,
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
