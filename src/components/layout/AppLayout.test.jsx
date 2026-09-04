import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { HouseholdContext } from '../../features/households/householdStateContext';
import { AppLayout } from './AppLayout';

const mocks = vi.hoisted(() => ({
  listUnread: vi.fn().mockResolvedValue([]),
  logout: vi.fn().mockResolvedValue({ loggedOut: true }),
}));

vi.mock('../../features/notifications/notificationService', () => ({
  notificationService: {
    listUnread: mocks.listUnread,
  },
}));

vi.mock('../../features/auth/authQueries', () => ({
  useLogoutMutation: () => ({
    isPending: false,
    mutateAsync: mocks.logout,
  }),
}));

const householdState = {
  currentHousehold: null,
  households: [],
  selectHousehold: () => undefined,
};

function WithHousehold({ children }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <HouseholdContext.Provider value={householdState}>{children}</HouseholdContext.Provider>
    </QueryClientProvider>
  );
}

describe('AppLayout', () => {
  it('muestra exactamente cinco destinos en la navegación móvil', () => {
    render(
      <WithHousehold>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="dashboard" element={<h1>Panel de prueba</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </WithHousehold>,
    );

    const mobileNavigation = screen.getByRole('navigation', {
      name: 'Navegación principal móvil',
    });
    const links = within(mobileNavigation).getAllByRole('link');

    expect(links).toHaveLength(5);
    expect(links.map((link) => link.textContent)).toEqual([
      'Inicio',
      'Gastos',
      'Calendario',
      'Planificación',
      'Más',
    ]);
  });

  it('ofrece un enlace para saltar al contenido', () => {
    render(
      <WithHousehold>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="dashboard" element={<h1>Panel de prueba</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </WithHousehold>,
    );

    expect(
      screen.getByRole('link', { name: 'Saltar al contenido principal' }),
    ).toHaveAttribute('href', '#contenido-principal');
    expect(document.getElementById('contenido-principal')).toHaveClass('focus:outline-none');
  });

  it('mantiene el acceso global a notificaciones sin añadir otro destino móvil', async () => {
    render(
      <WithHousehold>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="dashboard" element={<h1>Panel de prueba</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </WithHousehold>,
    );

    const notificationLinks = await screen.findAllByRole('link', {
      name: 'Notificaciones, ninguna sin leer',
    });
    expect(notificationLinks).toHaveLength(2);
    notificationLinks.forEach((link) =>
      expect(link).toHaveAttribute('href', '/notificaciones'),
    );
    expect(
      within(screen.getByRole('navigation', { name: 'Navegación principal móvil' }))
        .getAllByRole('link'),
    ).toHaveLength(5);
  });

  it('anuncia y muestra el contador de avisos sin leer', async () => {
    mocks.listUnread.mockResolvedValueOnce([{ id: 'notification-1' }]);

    render(
      <WithHousehold>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="dashboard" element={<h1>Panel de prueba</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </WithHousehold>,
    );

    const notificationLinks = await screen.findAllByRole('link', {
      name: 'Notificaciones, 1 aviso sin leer',
    });
    expect(notificationLinks).toHaveLength(2);
    notificationLinks.forEach((link) => expect(link).toHaveTextContent('1'));
  });

  it('mantiene activo el destino principal al navegar por páginas secundarias', () => {
    render(
      <WithHousehold>
        <MemoryRouter initialEntries={['/facturas']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="facturas" element={<h1>Facturas</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </WithHousehold>,
    );

    const expenseLinks = screen.getAllByRole('link', { name: 'Gastos' });
    expect(expenseLinks).toHaveLength(2);
    expenseLinks.forEach((link) => expect(link).toHaveAttribute('aria-current', 'page'));
  });

  it('resalta visualmente la pestaña activa en escritorio y móvil', () => {
    render(
      <WithHousehold>
        <MemoryRouter initialEntries={['/planificacion']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="planificacion" element={<h1>Planificación</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </WithHousehold>,
    );

    const planningLinks = screen.getAllByRole('link', { name: 'Planificación' });
    expect(planningLinks).toHaveLength(2);
    planningLinks.forEach((link) => {
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(link).toHaveClass('bg-brand-soft');
      expect(link).toHaveClass('ring-1');
    });
  });

  it('ofrece un cierre de sesión directo en escritorio y móvil', async () => {
    const user = userEvent.setup();
    render(
      <WithHousehold>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="dashboard" element={<h1>Panel de prueba</h1>} />
            </Route>
            <Route path="login" element={<h1>Iniciar sesión</h1>} />
          </Routes>
        </MemoryRouter>
      </WithHousehold>,
    );

    const logoutButtons = screen.getAllByRole('button', { name: 'Cerrar sesión' });
    expect(logoutButtons).toHaveLength(2);
    await user.click(logoutButtons[0]);

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
