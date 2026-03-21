import axios from 'axios';

// In local dev, Vite proxies /api → localhost:8080 (see vite.config.ts).
// In production (Vercel), VITE_API_URL is set to the deployed backend URL,
// e.g. https://your-app.up.railway.app  — no /api prefix needed there.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT from localStorage to every outgoing request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('pp_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
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

    let message = 'An unexpected error occurred.';
    if (typeof data === 'object' && data !== null) {
      message = data.message || data.error || data.detail || message;
    } else if (typeof data === 'string' && data.length < 200) {
      message = data;
    }

    if (status === 401) {
      message = 'Unauthorized. Please log in again.';
    } else if (status === 403) {
      message = 'You do not have permission to perform this action.';
    } else if (status === 404) {
      message = data?.message || 'The requested resource was not found.';
    } else if (status >= 500) {
      message = data?.message || 'Server error. Please try again later.';
    }

    // Log API errors to backend (lazy import to avoid circular dependency; skip error-logs endpoint)
    const requestUrl = error.config?.url || '';
    if (!requestUrl.includes('/error-logs')) {
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
