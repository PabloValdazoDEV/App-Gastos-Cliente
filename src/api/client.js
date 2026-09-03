import axios from 'axios';

import { publicEnv } from '../config/env';
import { createSingleFlight } from './singleFlight';

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

const refreshClient = axios.create({
  baseURL: publicEnv.apiUrl,
  headers: { Accept: 'application/json' },
  timeout: API_TIMEOUT_MS,
  withCredentials: true,
});

const refreshSession = createSingleFlight(() =>
  refreshClient.post('/auth/refresh', null, attachCsrfToken({
    headers: {},
    method: 'post',
  })),
);

export const apiClient = axios.create({
  baseURL: publicEnv.apiUrl,
  headers: { Accept: 'application/json' },
  timeout: API_TIMEOUT_MS,
  withCredentials: true,
});

apiClient.interceptors.request.use(attachCsrfToken);

apiClient.interceptors.response.use(
  (response) => {
    if (isAuthPath(response.config?.url)) {
      sessionExpiredEmitted = false;
    }

    return response;
  },
  async (error) => {
    if (!shouldRefreshSession(error)) {
      return Promise.reject(await toApiErrorWithBlob(error));
    }

    error.config._retryAfterRefresh = true;

    try {
      await refreshSession();
      sessionExpiredEmitted = false;
      return apiClient.request(error.config);
    } catch (refreshError) {
      emitSessionExpired();
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
