import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const forgotMutation = vi.hoisted(() => ({
  error: null,
  isPending: false,
  mutateAsync: vi.fn(),
}));

vi.mock('../../features/auth/authQueries', () => ({
  useForgotPasswordMutation: () => forgotMutation,
}));

import { ForgotPasswordPage } from './ForgotPasswordPage';

describe('ForgotPasswordPage', () => {
  it('muestra siempre el mensaje genérico tras enviar', async () => {
    const user = userEvent.setup();
    forgotMutation.mutateAsync.mockResolvedValue({ message: 'respuesta del servidor' });

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Email'), 'persona@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar instrucciones' }));

    expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeInTheDocument();
    expect(
      screen.getByText(/Si existe una cuenta asociada al correo/),
    ).toBeInTheDocument();
    expect(screen.queryByText('respuesta del servidor')).not.toBeInTheDocument();
  });
});

