import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const loginMutation = vi.hoisted(() => ({
  error: null,
  isPending: false,
  mutateAsync: vi.fn(),
}));

vi.mock('../../features/auth/authQueries', () => ({
  useLoginMutation: () => loginMutation,
}));

import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('mantiene labels visibles y envía las credenciales', async () => {
    const user = userEvent.setup();
    loginMutation.mutateAsync.mockResolvedValue({ id: 'user-1' });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="dashboard" element={<h1>Panel privado</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Email'), 'persona@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'cualquier-clave');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(loginMutation.mutateAsync).toHaveBeenCalledWith({
      email: 'persona@example.com',
      password: 'cualquier-clave',
    });
    expect(await screen.findByRole('heading', { name: 'Panel privado' })).toBeInTheDocument();
  });

  it('muestra errores accionables sin enviar datos incompletos', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByText('Introduce tu email.')).toBeInTheDocument();
    expect(screen.getByText('Introduce tu contraseña.')).toBeInTheDocument();
  });

  it('retorna a la invitación completa después de iniciar sesión', async () => {
    const user = userEvent.setup();
    loginMutation.mutateAsync.mockResolvedValue({ id: 'user-1' });

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
          <Route path="login" element={<LoginPage />} />
          <Route
            path="invitaciones/aceptar"
            element={<h1>Aceptar invitación</h1>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Email'), 'persona@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'cualquier-clave');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(
      await screen.findByRole('heading', { name: 'Aceptar invitación' }),
    ).toBeInTheDocument();
  });
});
