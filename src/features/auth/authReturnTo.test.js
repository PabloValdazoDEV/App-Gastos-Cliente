import { afterEach, describe, expect, it } from 'vitest';

import {
  authDestinationLocation,
  getAuthDestination,
  readStoredAuthDestination,
  storeAuthDestination,
} from './authReturnTo';

describe('destino de retorno de autenticación', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('conserva una ruta interna con query y fragmento', () => {
    const from = {
      hash: '#token=invitation-token',
      pathname: '/invitaciones/aceptar',
      search: '?source=email',
    };

    expect(getAuthDestination(from)).toBe(
      '/invitaciones/aceptar?source=email#token=invitation-token',
    );
    expect(authDestinationLocation(getAuthDestination(from))).toEqual(from);
  });

  it('rechaza destinos externos o ambiguos', () => {
    expect(getAuthDestination('//attacker.example/path')).toBe('/dashboard');
    expect(getAuthDestination('/\\attacker.example/path')).toBe('/dashboard');
    expect(getAuthDestination('https://attacker.example/path')).toBe('/dashboard');
  });

  it('persiste el retorno de Google solo durante el flujo y permite consumirlo', () => {
    storeAuthDestination({
      hash: '#token=secure-token',
      pathname: '/invitaciones/aceptar',
    });

    expect(readStoredAuthDestination()).toBe(
      '/invitaciones/aceptar#token=secure-token',
    );
    expect(readStoredAuthDestination({ consume: true })).toBe(
      '/invitaciones/aceptar#token=secure-token',
    );
    expect(readStoredAuthDestination()).toBe('/dashboard');
  });
});
