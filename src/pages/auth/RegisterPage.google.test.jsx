import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const registerMutation = vi.hoisted(() => ({
  error: null,
  isPending: false,
  mutateAsync: vi.fn(),
}));
const privacyQuery = vi.hoisted(() => ({
  data: {
    configured: true,
    controller: {
      contactEmail: 'privacidad@example.com',
      name: 'Responsable Demo',
    },
    effectiveDate: '2026-08-26',
    version: '2026/08 vigente',
  },
  isError: false,
  isFetching: false,
  isPending: false,
  isSuccess: true,
  refetch: vi.fn(),
}));

vi.mock('../../config/env', () => ({
  publicEnv: {
    apiUrl: 'http://localhost:3000/api',
    enableGoogleLogin: true,
  },
}));
vi.mock('../../features/auth/authQueries', () => ({
  useRegisterMutation: () => registerMutation,
}));
vi.mock('../../features/legal/privacyPolicyQueries', () => ({
  usePrivacyPolicyQuery: () => privacyQuery,
}));

import { RegisterPage } from './RegisterPage';

describe('RegisterPage con Google habilitado', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('solo habilita el alta Google tras confirmar la misma versión', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/register',
            state: { from: { pathname: '/invitaciones/aceptar', hash: '#token=abc' } },
          },
        ]}
      >
        <RegisterPage />
      </MemoryRouter>,
    );

    const googleLink = screen.getByRole('link', { name: 'Crear cuenta con Google' });
    expect(googleLink).toHaveAttribute('aria-disabled', 'true');
    expect(googleLink).toHaveAttribute(
      'href',
      'http://localhost:3000/api/auth/google/start?privacyPolicyAcknowledged=true&privacyPolicyVersion=2026%2F08%20vigente',
    );

    await user.click(
      screen.getByRole('checkbox', { name: /Confirmo que he leído/ }),
    );
    expect(googleLink).toHaveAttribute('aria-disabled', 'false');

    googleLink.addEventListener('click', (event) => event.preventDefault());
    await user.click(googleLink);
    expect(window.sessionStorage.getItem('budgetapp.authReturnTo')).toBe(
      '/invitaciones/aceptar#token=abc',
    );
  });
});
