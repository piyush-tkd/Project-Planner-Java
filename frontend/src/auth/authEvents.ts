/**
 * Lightweight event bridge between the axios interceptor and AuthContext.
 *
 * The interceptor can't import AuthContext (circular dep), so it fires
 * a custom event which AuthProvider listens for and triggers logout + redirect.
 */

const AUTH_EXPIRED_EVENT = 'pp:auth-expired';

/** Fire from the axios 401 handler. */
export function fireAuthExpired() {
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

/** Subscribe inside AuthProvider. Returns cleanup function. */
export function onAuthExpired(callback: () => void): () => void {
  window.addEventListener(AUTH_EXPIRED_EVENT, callback);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, callback);
}
