import { describe, expect, it } from 'vitest';

import { parsePublicEnv } from './env';

const validEnv = {
  VITE_API_URL: 'http://localhost:3000/api/',
  VITE_APP_NAME: 'BudgetApp',
  VITE_ENABLE_GOOGLE_LOGIN: 'false',
  VITE_ENABLE_WEB_PUSH: 'false',
};

describe('parsePublicEnv', () => {
  it('normaliza la URL y convierte las flags a booleanos', () => {
    expect(parsePublicEnv(validEnv)).toMatchObject({
      apiUrl: 'http://localhost:3000/api',
      appName: 'BudgetApp',
      csrfCookieName: 'csrf_token',
      enableGoogleLogin: false,
      enableWebPush: false,
    });
  });

  it('acepta una ruta de API relativa al mismo origen', () => {
    expect(
      parsePublicEnv({ ...validEnv, VITE_API_URL: '/api/' }).apiUrl,
    ).toBe('/api');
  });

  it('falla con un mensaje accionable si falta la URL de API', () => {
    expect(() =>
      parsePublicEnv({ ...validEnv, VITE_API_URL: undefined }),
    ).toThrow(/VITE_API_URL/);
  });

  it('permite mostrar Google Login sin duplicar la credencial del servidor', () => {
    expect(
      parsePublicEnv({
        ...validEnv,
        VITE_ENABLE_GOOGLE_LOGIN: 'true',
      }).enableGoogleLogin,
    ).toBe(true);
  });
});
