import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AxiosError } from 'axios';

import { apiClient, refreshClient, setCsrfToken, toApiErrorWithBlob } from './client';

describe('normalización de errores blob', () => {
  it('recupera el código y mensaje JSON de una descarga fallida', async () => {
    const response = {
      code: 'INVOICE_DOCUMENT_NOT_FOUND',
      message: 'El documento ya no existe.',
      requestId: 'request-1',
    };
    const error = {
      response: {
        data: new Blob([JSON.stringify(response)], { type: 'application/json' }),
        headers: { 'content-type': 'application/json; charset=utf-8' },
        status: 404,
      },
    };

    await expect(toApiErrorWithBlob(error)).resolves.toMatchObject({
      code: 'INVOICE_DOCUMENT_NOT_FOUND',
      message: 'El documento ya no existe.',
      requestId: 'request-1',
      status: 404,
    });
  });
});



function reply(config, status, data) {
  const response = { config, data, headers: {}, request: {}, status, statusText: '' };
  if (status >= 200 && status < 300) return Promise.resolve(response);
  return Promise.reject(new AxiosError(`HTTP ${status}`, null, config, {}, response));
}

describe('sesión y CSRF en producción', () => {
  let originalApiAdapter;
  let originalRefreshAdapter;
  let expired;
  const onExpired = () => { expired += 1; };

  beforeEach(() => {
    originalApiAdapter = apiClient.defaults.adapter;
    originalRefreshAdapter = refreshClient.defaults.adapter;
    expired = 0;
    window.addEventListener('budgetapp:session-expired', onExpired);
    setCsrfToken('old-token');
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalApiAdapter;
    refreshClient.defaults.adapter = originalRefreshAdapter;
    window.removeEventListener('budgetapp:session-expired', onExpired);
    vi.unstubAllGlobals();
  });

  it('si el token CSRF caducó (24 h), pide uno nuevo y repite el guardado una sola vez', async () => {
    const sentTokens = [];
    apiClient.defaults.adapter = (config) => {
      const token = config.headers.get?.('X-CSRF-Token') ?? config.headers['X-CSRF-Token'];
      sentTokens.push(token);
      return token === 'fresh-token'
        ? reply(config, 200, { success: true, data: { saved: true } })
        : reply(config, 403, { code: 'CSRF_TOKEN_INVALID' });
    };
    refreshClient.defaults.adapter = (config) => reply(config, 200, { success: true, data: { csrfToken: 'fresh-token' } });

    const response = await apiClient.post('/households/h/one-time-expenses', { name: 'Dentista' });

    expect(response.data.data).toEqual({ saved: true });
    expect(sentTokens).toEqual(['old-token', 'fresh-token']);
  });

  it('un 429 al renovar la sesión no echa al usuario a la pantalla de login', async () => {
    apiClient.defaults.adapter = (config) => reply(config, 401, { code: 'AUTHENTICATION_REQUIRED' });
    refreshClient.defaults.adapter = (config) => reply(config, 429, { code: 'AUTH_REFRESH_RATE_LIMIT_EXCEEDED' });

    await expect(apiClient.get('/households')).rejects.toMatchObject({ status: 429 });
    expect(expired).toBe(0);
  });

  it('renueva la sesión dentro de un bloqueo compartido entre pestañas', async () => {
    const request = vi.fn((_name, operation) => operation());
    vi.stubGlobal('navigator', { ...navigator, locks: { request } });
    let calls = 0;
    apiClient.defaults.adapter = (config) => {
      calls += 1;
      return calls === 1 ? reply(config, 401, {}) : reply(config, 200, { success: true, data: [] });
    };
    refreshClient.defaults.adapter = (config) => reply(config, 200, { success: true, data: {} });

    await apiClient.get('/households');

    expect(request).toHaveBeenCalledWith('budgetapp-auth-refresh', expect.any(Function));
  });

  it('si el servidor rechaza la renovación (401), avisa de que la sesión ha caducado', async () => {
    apiClient.defaults.adapter = (config) => reply(config, 401, {});
    refreshClient.defaults.adapter = (config) => reply(config, 401, { code: 'REFRESH_TOKEN_INVALID' });

    await expect(apiClient.get('/households')).rejects.toMatchObject({ status: 401 });
    expect(expired).toBe(1);
  });
});
