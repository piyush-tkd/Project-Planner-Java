/**
 * Lightweight event bridge between the axios interceptor and AuthContext.
 *
 * The interceptor can't import AuthContext (circular dep), so it fires
 * a custom event which AuthProvider listens for and triggers logout + redirect.
 *
 * Deduplication: once fireAuthExpired() fires, further calls are suppressed
 * until allowAuthExpiredEvents() is called (on successful login).
 * This prevents the "logout storm" where many concurrent 401 responses all
 * queue up POST /api/auth/logout requests that execute after the user re-logs in.
 */

const AUTH_EXPIRED_EVENT = 'pp:auth-expired';

let suppressed = false;

/** Fire from the axios 401 handler. Only the first call per auth cycle fires. */
export function fireAuthExpired(): void {
  if (suppressed) return;
  suppressed = true;
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

/**
 * Call this on successful login so future session expirations can be detected again.
 * Without this, a second expiry after re-login would be silently ignored.
 */
export function allowAuthExpiredEvents(): void {
  suppressed = false;
}

/** Subscribe inside AuthProvider. Returns cleanup function. */
export function onAuthExpired(callback: () => void): () => void {
  window.addEventListener(AUTH_EXPIRED_EVENT, callback);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, callback);
}
