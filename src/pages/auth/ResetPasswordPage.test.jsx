import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const resetMutation = vi.hoisted(() => ({
  error: null,
  isPending: false,
  mutateAsync: vi.fn(),
}));

vi.mock('../../features/auth/authQueries', () => ({
  useResetPasswordMutation: () => resetMutation,
}));

import { ResetPasswordPage } from './ResetPasswordPage';

function renderPage(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ResetPasswordPage', () => {
  it('rechaza enlaces sin un token con longitud segura', () => {
    renderPage('/reset-password?token=corto');

    expect(screen.getByRole('heading', { name: 'Enlace no válido' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Solicitar otro enlace' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('envía token y contraseña sin enviar la confirmación', async () => {
    const user = userEvent.setup();
    const token = 'a'.repeat(64);
    resetMutation.mutateAsync.mockResolvedValue({ passwordReset: true });
    renderPage(`/reset-password?token=${token}`);

    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva123!');
    await user.type(screen.getByLabelText('Repite la nueva contraseña'), 'Nueva123!');
    await user.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }));

    expect(resetMutation.mutateAsync).toHaveBeenCalledWith({
      password: 'Nueva123!',
      token,
    });
    expect(
      await screen.findByRole('heading', { name: 'Contraseña actualizada' }),
    ).toBeInTheDocument();
  });
});

