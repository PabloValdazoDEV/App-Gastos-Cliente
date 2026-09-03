import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientMocks = vi.hoisted(() => ({
  clearCsrfToken: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  setCsrfToken: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  clearCsrfToken: clientMocks.clearCsrfToken,
  http: {
    delete: clientMocks.delete,
    get: clientMocks.get,
    post: clientMocks.post,
  },
  setCsrfToken: clientMocks.setCsrfToken,
}));

import { authService, resetAuthTransport } from './authService';

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthTransport();
    clientMocks.get.mockImplementation((path) => {
      if (path === '/auth/csrf') return Promise.resolve({ csrfToken: 'csrf-demo' });
      return Promise.resolve({});
    });
  });

  it('obtiene CSRF antes de registrar y no envía la confirmación', async () => {
    clientMocks.post.mockResolvedValue({ user: { id: 'user-1' } });

    const user = await authService.register({
      email: 'persona@example.com',
      name: 'Persona',
      password: 'Segura123!',
      passwordConfirmation: 'Segura123!',
      privacyPolicyAcknowledged: true,
      privacyPolicyVersion: '2026-08-26',
    });

    expect(clientMocks.get).toHaveBeenCalledWith('/auth/csrf');
    expect(clientMocks.setCsrfToken).toHaveBeenCalledWith('csrf-demo');
    expect(clientMocks.post).toHaveBeenCalledWith('/auth/register', {
      email: 'persona@example.com',
      name: 'Persona',
      password: 'Segura123!',
      privacyPolicyAcknowledged: true,
      privacyPolicyVersion: '2026-08-26',
    });
    expect(user).toEqual({ id: 'user-1' });
  });

  it('envía el token de recuperación en el body', async () => {
    clientMocks.post.mockResolvedValue({ passwordReset: true });

    await authService.resetPassword({ password: 'Nueva123!', token: 'token-opaco' });

    expect(clientMocks.post).toHaveBeenCalledWith('/auth/reset-password', {
      password: 'Nueva123!',
      token: 'token-opaco',
    });
  });

  it('revoca una sesión por su identificador', async () => {
    clientMocks.delete.mockResolvedValue({ revoked: true });

    await authService.revokeSession('session-1');

    expect(clientMocks.delete).toHaveBeenCalledWith('/auth/sessions/session-1');
  });

  it('limpia el CSRF en memoria después de logout', async () => {
    clientMocks.post.mockResolvedValue({ loggedOut: true });

    await authService.logout();

    expect(clientMocks.clearCsrfToken).toHaveBeenCalled();
  });

  it('renueva CSRF y reintenta una mutación una sola vez si ha caducado', async () => {
    clientMocks.post
      .mockRejectedValueOnce({ code: 'CSRF_TOKEN_INVALID' })
      .mockResolvedValueOnce({ user: { id: 'user-1' } });

    await authService.login({ email: 'persona@example.com', password: 'clave' });

    expect(clientMocks.get).toHaveBeenCalledTimes(2);
    expect(clientMocks.post).toHaveBeenCalledTimes(2);
  });
});
