import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  session: {
    isPending: false,
    isSuccess: false,
  },
}));

vi.mock('../api/client', () => ({
  http: { post: mocks.post },
}));

vi.mock('../features/auth/authQueries', () => ({
  useCurrentUserQuery: () => mocks.session,
}));

import { InvitationAcceptPage } from './InvitationAcceptPage';

const token = 'a'.repeat(43);
const preview = {
  emailHint: 'pa***@example.com',
  household: { id: 'household-1', name: 'Casa' },
  householdPerson: { id: 'person-1', name: 'Pablo' },
  invitedByName: 'Ana',
  role: 'MEMBER',
};

function LoginReturnProbe() {
  const location = useLocation();
  const from = location.state?.from;

  return <p>{`${from?.pathname ?? ''}${from?.hash ?? ''}`}</p>;
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[`/invitaciones/aceptar#token=${token}`]}
      >
        <Routes>
          <Route
            path="invitaciones/aceptar"
            element={<InvitationAcceptPage />}
          />
          <Route path="login" element={<LoginReturnProbe />} />
          <Route path="hogar" element={<h1>Hogar aceptado</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('InvitationAcceptPage', () => {
  beforeEach(() => {
    mocks.session = { isPending: false, isSuccess: false };
    mocks.post.mockImplementation((url) => {
      if (url === '/invitations/preview') return Promise.resolve(preview);
      if (url === '/invitations/accept') return Promise.resolve({ accepted: true });
      return Promise.reject(new Error(`Ruta inesperada: ${url}`));
    });
  });

  it('previsualiza sin sesión y conserva el token al ir al login', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Casa' })).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledWith('/invitations/preview', { token });

    await user.click(
      screen.getByRole('link', { name: 'Iniciar sesión para aceptar' }),
    );

    expect(
      await screen.findByText(`/invitaciones/aceptar#token=${token}`),
    ).toBeInTheDocument();
  });

  it('acepta con sesión mediante el contrato protegido del backend', async () => {
    const user = userEvent.setup();
    mocks.session = { isPending: false, isSuccess: true };
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Aceptar invitación' }),
    );

    expect(mocks.post).toHaveBeenCalledWith('/invitations/accept', { token });
    expect(
      await screen.findByRole('heading', { name: 'Hogar aceptado' }),
    ).toBeInTheDocument();
  });
});
