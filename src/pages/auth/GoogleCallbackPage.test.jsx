import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  currentUser: {
    isError: false,
    isSuccess: true,
  },
  linkMutation: {
    error: null,
    isPending: false,
    mutateAsync: vi.fn(),
  },
}));

vi.mock('../../features/auth/authQueries', () => ({
  useCurrentUserQuery: () => authMocks.currentUser,
  useGoogleLinkMutation: () => authMocks.linkMutation,
}));

import { GoogleCallbackPage } from './GoogleCallbackPage';

function LoginReturnProbe() {
  const location = useLocation();
  const from = location.state?.from;

  return <p>{`${from?.pathname ?? ''}${from?.search ?? ''}${from?.hash ?? ''}`}</p>;
}

describe('GoogleCallbackPage', () => {
  beforeEach(() => {
    authMocks.currentUser = { isError: false, isSuccess: true };
    window.sessionStorage.clear();
  });

  it('retorna a la invitación al confirmar la sesión de Google', async () => {
    window.sessionStorage.setItem(
      'budgetapp.authReturnTo',
      '/invitaciones/aceptar#token=secure-token',
    );

    render(
      <MemoryRouter initialEntries={['/auth/callback?status=success']}>
        <Routes>
          <Route path="auth/callback" element={<GoogleCallbackPage />} />
          <Route
            path="invitaciones/aceptar"
            element={<h1>Aceptar invitación</h1>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Aceptar invitación' }),
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem('budgetapp.authReturnTo')).toBeNull();
  });

  it('conserva el retorno al volver al login después de un error OAuth', async () => {
    const user = userEvent.setup();
    authMocks.currentUser = { isError: false, isSuccess: false };
    window.sessionStorage.setItem(
      'budgetapp.authReturnTo',
      '/invitaciones/aceptar#token=secure-token',
    );

    render(
      <MemoryRouter
        initialEntries={[
          '/auth/callback?status=error&error=GOOGLE_AUTH_FAILED',
        ]}
      >
        <Routes>
          <Route path="auth/callback" element={<GoogleCallbackPage />} />
          <Route path="login" element={<LoginReturnProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('link', { name: 'Volver a iniciar sesión' }));

    expect(
      await screen.findByText('/invitaciones/aceptar#token=secure-token'),
    ).toBeInTheDocument();
  });

  it.each([
    [
      'PRIVACY_POLICY_ACKNOWLEDGEMENT_REQUIRED',
      'Debes confirmar que has leído la Política de privacidad antes de crear una cuenta con Google.',
    ],
    [
      'PRIVACY_POLICY_NOT_CONFIGURED',
      'El registro está deshabilitado hasta que se configure la Política de privacidad.',
    ],
    [
      'PRIVACY_POLICY_OUTDATED',
      'La Política de privacidad ha cambiado. Revísala y vuelve a confirmar la versión vigente desde el registro.',
    ],
  ])('explica el error de privacidad %s', (errorCode, message) => {
    authMocks.currentUser = { isError: false, isSuccess: false };

    render(
      <MemoryRouter
        initialEntries={[
          `/auth/callback?status=error&error=${errorCode}`,
        ]}
      >
        <GoogleCallbackPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText((content) => content.includes(message)),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Volver al registro' }),
    ).toHaveAttribute('href', '/register');
  });
});
