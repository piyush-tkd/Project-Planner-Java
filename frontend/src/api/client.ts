import axios from 'axios';
import { fireAuthExpired } from '../auth/authEvents';

// ── Error deduplication: suppress repeated identical errors within a time window ──
const recentErrors = new Map<string, number>();  // key → timestamp
const ERROR_DEDUP_WINDOW_MS = 60_000;  // Only log same error once per 60s

function shouldLogError(key: string): boolean {
  const now = Date.now();
  const lastLogged = recentErrors.get(key);
  if (lastLogged && now - lastLogged < ERROR_DEDUP_WINDOW_MS) {
    return false;  // duplicate within window, skip
  }
  recentErrors.set(key, now);
  // Prune old entries periodically (keep map from growing forever)
  if (recentErrors.size > 100) {
    for (const [k, ts] of recentErrors) {
      if (now - ts > ERROR_DEDUP_WINDOW_MS) recentErrors.delete(k);
    }
  }
  return true;
}

// In local dev, Vite proxies /api → localhost:8080 (see vite.config.ts).
// In production (Vercel), VITE_API_URL is set to the deployed backend URL,
// e.g. https://your-app.up.railway.app  — no /api prefix needed there.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
  timeout: 120000,  // 2 min — Jira live API calls can take 60+ seconds
  // Send the HttpOnly access_token cookie on every request (including cross-origin).
  // The Authorization: Bearer header is no longer used by the browser — the cookie
  // is attached automatically by the browser once set via Set-Cookie on login.
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return Promise.reject(new Error('Request timed out. Please try again.'));
    }

    if (!error.response) {
      return Promise.reject(new Error('Network error. Please check your connection and try again.'));
    }

    const data = error.response.data;
    const status = error.response.status;
    const requestUrl = error.config?.url || '';

    let message = 'An unexpected error occurred.';
    if (typeof data === 'object' && data !== null) {
      message = data.message || data.error || data.detail || message;
    } else if (typeof data === 'string' && data.length < 200) {
      message = data;
    }

    // Improve Spring Boot "No static resource" messages — these indicate the backend
    // controller didn't match the request (likely backend not recompiled with latest endpoints)
    if (message.includes('No static resource')) {
      message = `Backend endpoint not available: ${requestUrl || 'unknown'}. The server may need to be restarted.`;
    }

    if (status === 401) {
      message = 'Session expired. Redirecting to login…';
      // Don't fire if we're already on the login page (e.g. bad password attempt)
      // or if it's the /auth/me bootstrap call that's allowed to fail silently.
      const isLoginPage = window.location.pathname.startsWith('/login');
      const isAuthEndpoint = requestUrl.includes('/auth/');
      if (!isLoginPage && !isAuthEndpoint) {
        fireAuthExpired();
      }
    } else if (status === 403) {
      message = 'You do not have permission to perform this action.';
    } else if (status === 404) {
      message = data?.message || 'The requested resource was not found.';
    } else if (status >= 500) {
      // Don't override the improved "No static resource" message
      if (!message.includes('Backend endpoint not available')) {
        message = data?.message || 'Server error. Please try again later.';
      }
    }

    // Log API errors to backend (lazy import to avoid circular dependency; skip error-logs endpoint)
    // Deduplication: identical endpoint + status combos only log once per 60s
    const dedupKey = `${status}:${requestUrl}:${window.location.pathname}`;
    if (!requestUrl.includes('/error-logs') && shouldLogError(dedupKey)) {
      import('./errorLogs').then(({ logErrorToServer }) => {
        logErrorToServer({
          source: 'FRONTEND',
          severity: status >= 500 ? 'ERROR' : 'WARN',
          errorType: `HTTP_${status}`,
          message,
          apiEndpoint: requestUrl,
          httpStatus: status,
          pageUrl: window.location.pathname,
          userAgent: navigator.userAgent,
        });
      }).catch(() => { /* ignore */ });
    }

    return Promise.reject(new Error(message));
  }
);

export default apiClient;
