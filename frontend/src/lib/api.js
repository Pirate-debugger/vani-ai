import axios from 'axios';

/**
 * Returns the resolved API base URL.
 * Handles environment overrides and trailing slash trimming.
 */
export function getApiBaseUrl() {
  const envUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || '').trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return '';
}

/**
 * Constructs an absolute or relative API URL safely without duplicating '/api'
 * and preserving query strings.
 *
 * Examples:
 *   buildApiUrl('/projects') => '/api/projects' (or 'https://api.domain.com/api/projects')
 *   buildApiUrl('/api/health') => '/api/health'
 *   buildApiUrl('auth/me') => '/api/auth/me'
 */
export function buildApiUrl(path = '') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();

  const normalizedPath = cleanPath.startsWith('/api/') || cleanPath === '/api'
    ? cleanPath
    : `/api${cleanPath}`;

  return `${base}${normalizedPath}`;
}

/**
 * Canonical Axios instance configured with credentials and consistent headers.
 */
export const apiClient = axios.create({
  baseURL: getApiBaseUrl() || '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Vani-Client': 'web'
  }
});

apiClient.interceptors.request.use((config) => {
  if (config.url && !config.url.startsWith('http://') && !config.url.startsWith('https://')) {
    config.url = buildApiUrl(config.url);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Request failed';
    const code = error.response?.data?.code || (error.response?.status ? `HTTP_${error.response.status}` : 'NETWORK_ERROR');
    const enhancedError = new Error(message);
    enhancedError.status = error.response?.status;
    enhancedError.code = code;
    enhancedError.response = error.response;
    enhancedError.retryable = Boolean(error.response?.data?.retryable || (!error.response && error.code !== 'ECONNABORTED'));
    return Promise.reject(enhancedError);
  }
);

/**
 * Native fetch wrapper with credentials included and URL normalization.
 */
export async function apiFetch(path, options = {}) {
  const url = buildApiUrl(path);
  const headers = {
    'X-Vani-Client': 'web',
    ...(options.headers || {})
  };

  return fetch(url, {
    ...options,
    credentials: options.credentials || 'include',
    headers
  });
}

export default apiClient;
