import { clearCsrfToken, http, setCsrfToken } from '../../api/client';
import { createSingleFlight } from '../../api/singleFlight';

let csrfReady = false;

const fetchCsrfToken = createSingleFlight(async () => {
  const data = await http.get('/auth/csrf');

  if (!data?.csrfToken) {
    throw new Error('El servidor no ha entregado un token CSRF válido.');
  }

  setCsrfToken(data.csrfToken);
  csrfReady = true;
  return data.csrfToken;
});

export function ensureCsrfToken() {
  return csrfReady ? Promise.resolve() : fetchCsrfToken();
}

export function resetAuthTransport() {
  csrfReady = false;
  clearCsrfToken();
}

async function withCsrf(request) {
  await ensureCsrfToken();

  try {
    return await request();
  } catch (error) {
    if (error?.code !== 'CSRF_TOKEN_INVALID') throw error;

    resetAuthTransport();
    await ensureCsrfToken();
    return request();
  }
}

export const authService = {
  async getCurrentUser() {
    await ensureCsrfToken();
    const data = await http.get('/auth/me');
    return data.user;
  },

  async register(values) {
    const data = await withCsrf(() =>
      http.post('/auth/register', {
        email: values.email,
        name: values.name,
        password: values.password,
        privacyPolicyAcknowledged: values.privacyPolicyAcknowledged,
        privacyPolicyVersion: values.privacyPolicyVersion,
      }),
    );
    return data.user;
  },

  async login(values) {
    const data = await withCsrf(() => http.post('/auth/login', values));
    return data.user;
  },

  async logout() {
    const data = await withCsrf(() => http.post('/auth/logout'));
    resetAuthTransport();
    return data;
  },

  async logoutAll() {
    const data = await withCsrf(() => http.post('/auth/logout-all'));
    resetAuthTransport();
    return data;
  },

  forgotPassword(values) {
    return withCsrf(() => http.post('/auth/forgot-password', values));
  },

  resetPassword({ token, password }) {
    return withCsrf(() =>
      http.post('/auth/reset-password', { password, token }),
    );
  },

  async getSessions() {
    const data = await http.get('/auth/sessions');
    return data.sessions;
  },

  revokeSession(sessionId) {
    return withCsrf(() => http.delete(`/auth/sessions/${sessionId}`));
  },

  async confirmGoogleLink(values) {
    const data = await withCsrf(() =>
      http.post('/auth/google/link/confirm', values),
    );
    return data.user;
  },
};
