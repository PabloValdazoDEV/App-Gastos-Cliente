import { matchRoutes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { router } from './router';

describe('router público', () => {
  it('expone privacidad fuera de los guards de sesión', () => {
    const matches = matchRoutes(router.routes, '/privacidad');

    expect(matches).not.toBeNull();
    expect(matches.at(-1).route.path).toBe('privacidad');
    expect(matches).toHaveLength(2);
  });
});

describe('rutas de compras', () => {
  it.each([
    ['/compras', 'compras'],
    ['/compras/compra-1', 'compras/:purchaseId'],
  ])('incluye %s en el layout autenticado existente', (path, routePath) => {
    const matches = matchRoutes(router.routes, path);
    expect(matches.at(-1).route.path).toBe(routePath);
    expect(matches.some((match) => match.route.path === '/')).toBe(true);
    expect(matches.length).toBeGreaterThan(2);
  });
});
