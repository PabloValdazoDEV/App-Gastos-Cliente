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
