import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  clearSessionCache: vi.fn(),
  useCurrentUserQuery: vi.fn(),
}));

vi.mock('./authQueries', () => ({
  clearSessionCache: authMocks.clearSessionCache,
  useCurrentUserQuery: authMocks.useCurrentUserQuery,
}));

import { PublicOnly, RequireAuth, SessionEventBoundary } from './AuthRouteGuards';

describe('guards de autenticación', () => {
  it('permite entrar a una ruta privada con usuario', () => {
    authMocks.useCurrentUserQuery.mockReturnValue({
      data: { id: 'user-1' },
      isError: false,
      isPending: false,
    });

    render(
      <MemoryRouter initialEntries={['/privada']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="privada" element={<h1>Contenido privado</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Contenido privado' })).toBeInTheDocument();
  });

  it('redirige al login si la API responde 401', () => {
    authMocks.useCurrentUserQuery.mockReturnValue({
      error: { status: 401 },
      isError: true,
      isPending: false,
    });

    render(
      <MemoryRouter initialEntries={['/privada']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="privada" element={<h1>Contenido privado</h1>} />
          </Route>
          <Route path="login" element={<h1>Acceso</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Acceso' })).toBeInTheDocument();
  });

  it('redirige fuera del login si ya existe una sesión', () => {
    authMocks.useCurrentUserQuery.mockReturnValue({
      isPending: false,
      isSuccess: true,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="login" element={<h1>Acceso</h1>} />
          </Route>
          <Route path="dashboard" element={<h1>Panel</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Panel' })).toBeInTheDocument();
  });

  it('conserva el destino de invitación al encontrar una sesión ya iniciada', () => {
    authMocks.useCurrentUserQuery.mockReturnValue({
      isPending: false,
      isSuccess: true,
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/login',
            state: {
              from: {
                hash: '#token=secure-token',
                pathname: '/invitaciones/aceptar',
              },
            },
          },
        ]}
      >
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="login" element={<h1>Acceso</h1>} />
          </Route>
          <Route
            path="invitaciones/aceptar"
            element={<h1>Invitación recuperada</h1>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Invitación recuperada' }),
    ).toBeInTheDocument();
  });

  it('no expulsa al login al recibir session-expired en la invitación pública', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/invitaciones/aceptar#token=secure-token']}>
          <Routes>
            <Route element={<SessionEventBoundary />}>
              <Route
                path="invitaciones/aceptar"
                element={<h1>Vista pública de invitación</h1>}
              />
              <Route path="login" element={<h1>Acceso</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent('budgetapp:session-expired'));
    });

    expect(
      screen.getByRole('heading', { name: 'Vista pública de invitación' }),
    ).toBeInTheDocument();
    expect(authMocks.clearSessionCache).not.toHaveBeenCalled();
  });

  it('mantiene visible privacidad al recibir session-expired', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/privacidad']}>
          <Routes>
            <Route element={<SessionEventBoundary />}>
              <Route
                path="privacidad"
                element={<h1>Política pública</h1>}
              />
              <Route path="login" element={<h1>Acceso</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent('budgetapp:session-expired'));
    });

    expect(
      screen.getByRole('heading', { name: 'Política pública' }),
    ).toBeInTheDocument();
    expect(authMocks.clearSessionCache).not.toHaveBeenCalled();
  });
});
