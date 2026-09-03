import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    version: '2026-08-26',
  },
  isError: false,
  isFetching: false,
  isPending: false,
  isSuccess: true,
  refetch: vi.fn(),
}));

vi.mock('../../features/auth/authQueries', () => ({
  useRegisterMutation: () => registerMutation,
}));
vi.mock('../../features/legal/privacyPolicyQueries', () => ({
  usePrivacyPolicyQuery: () => privacyQuery,
}));

import { RegisterPage } from './RegisterPage';

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerMutation.error = null;
    registerMutation.isPending = false;
    privacyQuery.data = {
      configured: true,
      controller: {
        contactEmail: 'privacidad@example.com',
        name: 'Responsable Demo',
      },
      effectiveDate: '2026-08-26',
      version: '2026-08-26',
    };
    privacyQuery.isError = false;
    privacyQuery.isFetching = false;
    privacyQuery.isPending = false;
    privacyQuery.isSuccess = true;
  });

  it('crea la cuenta y retorna a la invitación sin enviar la repetición de contraseña', async () => {
    const user = userEvent.setup();
    registerMutation.mutateAsync.mockResolvedValue({ id: 'user-1' });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/register',
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
          <Route path="register" element={<RegisterPage />} />
          <Route
            path="invitaciones/aceptar"
            element={<h1>Aceptar invitación</h1>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Nombre'), 'Pablo');
    await user.type(screen.getByLabelText('Email'), 'pablo@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'ClaveSegura1!');
    await user.type(screen.getByLabelText('Repite la contraseña'), 'ClaveSegura1!');
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Confirmo que he leído la Política de privacidad y he sido informado sobre el tratamiento de mis datos',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));

    expect(registerMutation.mutateAsync).toHaveBeenCalledWith({
      email: 'pablo@example.com',
      name: 'Pablo',
      password: 'ClaveSegura1!',
      privacyPolicyAcknowledged: true,
      privacyPolicyVersion: '2026-08-26',
    });
    expect(
      await screen.findByRole('heading', { name: 'Aceptar invitación' }),
    ).toBeInTheDocument();
  });

  it('muestra la primera capa y un error accionable si no se confirma', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Información básica de protección de datos'),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => (
        element?.tagName === 'DD'
        && element.textContent.includes('Responsable Demo')
      )),
    ).toBeInTheDocument();
    expect(screen.getByText(/previsiones financieras orientativas/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Abrir la Política de privacidad/ }),
    ).toHaveAttribute('target', '_blank');

    await user.type(screen.getByLabelText('Nombre'), 'Pablo');
    await user.type(screen.getByLabelText('Email'), 'pablo@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'ClaveSegura1!');
    await user.type(screen.getByLabelText('Repite la contraseña'), 'ClaveSegura1!');
    await user.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));

    expect(
      await screen.findByText(
        'Confirma que has leído la Política de privacidad para crear tu cuenta.',
      ),
    ).toBeInTheDocument();
    expect(registerMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('bloquea el alta cuando la política no está configurada', () => {
    privacyQuery.data = {
      configured: false,
      controller: {
        address: null,
        contactEmail: null,
        dpoEmail: null,
        name: null,
      },
      effectiveDate: null,
      version: null,
    };

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Crear mi cuenta' })).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: /Confirmo que he leído/ }),
    ).toBeDisabled();
    expect(screen.getByText('Registro temporalmente no disponible')).toBeInTheDocument();
  });

  it('bloquea el alta y permite reintentar si falla la carga', async () => {
    const user = userEvent.setup();
    privacyQuery.data = undefined;
    privacyQuery.isError = true;
    privacyQuery.isSuccess = false;

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Crear mi cuenta' })).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: 'Reintentar carga de la política' }),
    );
    expect(privacyQuery.refetch).toHaveBeenCalled();
  });

  it('mantiene el alta bloqueada mientras carga la política', () => {
    privacyQuery.data = undefined;
    privacyQuery.isPending = true;
    privacyQuery.isSuccess = false;

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Crear mi cuenta' })).toBeDisabled();
    expect(
      screen.getByText(/Comprobando la información de privacidad/i),
    ).toHaveAttribute('role', 'status');
  });

  it('explica que debe revisar de nuevo la política tras un retorno Google obsoleto', () => {
    render(
      <MemoryRouter
        initialEntries={['/register?privacyError=PRIVACY_POLICY_OUTDATED']}
      >
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/La Política de privacidad ha cambiado/i),
    ).toBeInTheDocument();
  });

  it('retira la confirmación y recarga metadatos si el servidor rechaza una versión obsoleta', async () => {
    const user = userEvent.setup();
    registerMutation.mutateAsync.mockRejectedValue({
      code: 'PRIVACY_POLICY_OUTDATED',
    });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Nombre'), 'Pablo');
    await user.type(screen.getByLabelText('Email'), 'pablo@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'ClaveSegura1!');
    await user.type(screen.getByLabelText('Repite la contraseña'), 'ClaveSegura1!');
    const acknowledgement = screen.getByRole('checkbox', {
      name: /Confirmo que he leído/,
    });
    await user.click(acknowledgement);
    await user.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));

    expect(privacyQuery.refetch).toHaveBeenCalled();
    expect(acknowledgement).not.toBeChecked();
  });

  it('exige una nueva confirmación si cambia la versión cargada', async () => {
    const user = userEvent.setup();
    const view = render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    const acknowledgement = screen.getByRole('checkbox', {
      name: /Confirmo que he leído/,
    });
    await user.click(acknowledgement);
    expect(acknowledgement).toBeChecked();

    privacyQuery.data = {
      ...privacyQuery.data,
      version: '2026-09-01',
    };
    view.rerender(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(acknowledgement).not.toBeChecked());
  });
});
