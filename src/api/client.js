import axios from 'axios';

import { publicEnv } from '../config/env';
import { createSingleFlight } from './singleFlight';
import { developmentDateForRequest } from '../features/development/developmentDate';

const API_TIMEOUT_MS = 10_000;
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const MUTATING_METHODS = new Set(['delete', 'patch', 'post', 'put']);
const AUTH_PATHS_WITHOUT_REFRESH = [
  '/auth/csrf',
  '/auth/forgot-password',
  '/auth/google/callback',
  '/auth/google/link/confirm',
  '/auth/google/start',
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
  '/auth/register',
  '/auth/reset-password',
];

let csrfTokenInMemory = null;

export function setCsrfToken(token) {
  csrfTokenInMemory = typeof token === 'string' && token ? token : null;
}

export function clearCsrfToken() {
  csrfTokenInMemory = null;
}

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code ?? 'UNKNOWN_ERROR';
    this.details = options.details ?? null;
    this.requestId = options.requestId ?? null;
    this.status = options.status ?? null;
    this.cause = options.cause;
  }
}

function readCookie(name) {
  if (typeof document === 'undefined') {
    return null;
  }

  const encodedName = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(encodedName));

  if (!cookie) {
    return null;
  }

  try {
    return decodeURIComponent(cookie.slice(encodedName.length));
  } catch {
    return cookie.slice(encodedName.length);
  }
}

function setHeader(headers, name, value) {
  if (typeof headers?.set === 'function') {
    headers.set(name, value);
    return headers;
  }

  return { ...headers, [name]: value };
}

function attachCsrfToken(config) {
  const method = config.method?.toLowerCase();

  if (!MUTATING_METHODS.has(method)) {
    return config;
  }

  const csrfToken = csrfTokenInMemory ?? readCookie(publicEnv.csrfCookieName);

  if (csrfToken) {
    config.headers = setHeader(config.headers, CSRF_HEADER_NAME, csrfToken);
  }

  return config;
}

function getDefaultMessage(status) {
  if (status === 401) return 'Tu sesión ha caducado. Vuelve a iniciar sesión.';
  if (status === 403) return 'No tienes permiso para realizar esta acción.';
  if (status === 404) return 'No hemos encontrado el recurso solicitado.';
  if (status >= 500) return 'El servicio no está disponible en este momento.';
  return 'No se ha podido completar la solicitud.';
}

export function toApiError(error) {
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isCancel(error)) {
    return new ApiError('La solicitud se ha cancelado.', {
      cause: error,
      code: 'REQUEST_CANCELLED',
    });
  }

  if (!error?.response) {
    return new ApiError(
      'No podemos conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
      {
        cause: error,
        code: 'NETWORK_ERROR',
      },
    );
  }

  const { data, status } = error.response;

  return new ApiError(data?.message || getDefaultMessage(status), {
    cause: error,
    code: data?.code || `HTTP_${status}`,
    details: data?.details,
    requestId: data?.requestId,
    status,
  });
}

function readBlobText(blob) {
  if (typeof blob.text === 'function') return blob.text();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(blob);
  });
}

export async function toApiErrorWithBlob(error) {
  const responseData = error?.response?.data;
  const responseType = responseData?.type
    || error?.response?.headers?.['content-type']
    || '';

  if (
    typeof Blob !== 'undefined'
    && responseData instanceof Blob
    && responseType.toLowerCase().includes('application/json')
  ) {
    try {
      const parsedData = JSON.parse(await readBlobText(responseData));
      error.response.data = parsedData;
    } catch {
      // Conserva el mensaje seguro por estado si el servidor no devuelve JSON válido.
    }
  }

  return toApiError(error);
}

function isAuthPath(url = '') {
  let pathname = url;

  try {
    pathname = new URL(url, `${publicEnv.apiUrl}/`).pathname;
  } catch {
    // Axios also accepts relative paths. The raw value is enough as fallback.
  }

  return AUTH_PATHS_WITHOUT_REFRESH.some((path) => pathname.endsWith(path));
}

function shouldRefreshSession(error) {
  return Boolean(
    error?.response?.status === 401 &&
      error.config &&
      !error.config._retryAfterRefresh &&
      !isAuthPath(error.config.url),
  );
}

let sessionExpiredEmitted = false;

function emitSessionExpired() {
  if (sessionExpiredEmitted) return;

  sessionExpiredEmitted = true;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('budgetapp:session-expired'));
  }
}

// Exported only so tests can stub its transport.
export const refreshClient = axios.create({
  baseURL: publicEnv.apiUrl,
  headers: { Accept: 'application/json' },
  timeout: API_TIMEOUT_MS,
  withCredentials: true,
});

function isCsrfRejection(error) {
  return error?.response?.status === 403 && error.response.data?.code === 'CSRF_TOKEN_INVALID';
}

// The CSRF token expires after 24 h on the server. A tab left open longer
// gets a fresh one transparently instead of failing every save.
const fetchFreshCsrfToken = createSingleFlight(async () => {
  const response = await refreshClient.get('/auth/csrf');
  const token = response.data?.data?.csrfToken ?? response.data?.csrfToken;
  if (!token) throw new Error('El servidor no ha entregado un token CSRF válido.');
  setCsrfToken(token);
  return token;
});

function postRefresh() {
  return refreshClient.post('/auth/refresh', null, attachCsrfToken({
    headers: {},
    method: 'post',
  }));
}

/*
 * Two tabs refreshing at the same moment used to send the same refresh token
 * twice: the server sees it as token reuse and logs both tabs out. The Web
 * Locks API serializes refreshes across tabs; as cookies are shared, the
 * second tab's request already carries the rotated cookie.
 */
function withCrossTabRefreshLock(operation) {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks?.request) return operation();
  return locks.request('budgetapp-auth-refresh', operation);
}

const refreshSession = createSingleFlight(() =>
  withCrossTabRefreshLock(async () => {
    try {
      return await postRefresh();
    } catch (error) {
      if (!isCsrfRejection(error)) throw error;
      await fetchFreshCsrfToken();
      return postRefresh();
    }
  }),
);

// Only a rejected session means "logged out". Rate limits (429), server
// errors and lost connections keep the user signed in and can be retried.
function sessionWasRejected(error) {
  const status = error?.response?.status;
  return status === 401 || (status === 403 && !isCsrfRejection(error));
}

export const apiClient = axios.create({
  baseURL: publicEnv.apiUrl,
  headers: { Accept: 'application/json' },
  timeout: API_TIMEOUT_MS,
  withCredentials: true,
});

apiClient.interceptors.request.use(attachCsrfToken);
apiClient.interceptors.request.use((config) => {
  const date = developmentDateForRequest(config.url);
  if (date) config.headers = setHeader(config.headers, 'X-Development-Date', date);
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    if (isAuthPath(response.config?.url)) {
      sessionExpiredEmitted = false;
    }

    return response;
  },
  async (error) => {
    if (isCsrfRejection(error) && error.config && !error.config._retryAfterCsrf) {
      error.config._retryAfterCsrf = true;
      try {
        await fetchFreshCsrfToken();
      } catch {
        return Promise.reject(await toApiErrorWithBlob(error));
      }
      return apiClient.request(error.config);
    }

    if (!shouldRefreshSession(error)) {
      return Promise.reject(await toApiErrorWithBlob(error));
    }

    error.config._retryAfterRefresh = true;

    try {
      await refreshSession();
      sessionExpiredEmitted = false;
      return apiClient.request(error.config);
    } catch (refreshError) {
      if (sessionWasRejected(refreshError)) emitSessionExpired();
      return Promise.reject(await toApiErrorWithBlob(refreshError));
    }
  },
);

function unwrapResponse(response) {
  const body = response.data;

  if (body?.success === true && Object.hasOwn(body, 'data')) {
    return body.data;
  }

  return body;
}

export const http = {
  delete: (url, config) => apiClient.delete(url, config).then(unwrapResponse),
  get: (url, config) => apiClient.get(url, config).then(unwrapResponse),
  patch: (url, body, config) =>
    apiClient.patch(url, body, config).then(unwrapResponse),
  post: (url, body, config) =>
    apiClient.post(url, body, config).then(unwrapResponse),
  put: (url, body, config) =>
    apiClient.put(url, body, config).then(unwrapResponse),
};
