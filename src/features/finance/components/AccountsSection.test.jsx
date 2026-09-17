import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ accounts: vi.fn(), createAccount: vi.fn(), updateAccount: vi.fn(), deleteAccount: vi.fn() }));
vi.mock('../financeService', () => ({ financeService: mocks }));

import { AccountsSection } from './AccountsSection';

function renderAccounts() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const dashboardKeys = [['dashboard', 'home', '2026-09'], ['dashboard', 'home', 'planning']];
  for (const key of dashboardKeys) client.setQueryData(key, { cashCoverage: { common: { balanceCents: 145_000 } } });
  const result = render(<QueryClientProvider client={client}><AccountsSection currency="EUR" householdId="home" people={[]} /></QueryClientProvider>);
  return { ...result, client, dashboardKeys };
}

async function expectCoverageInvalidated(client, keys) {
  await waitFor(() => {
    for (const key of keys) expect(client.getQueryState(key).isInvalidated).toBe(true);
  });
}

describe('AccountsSection cash coverage refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accounts.mockResolvedValue([{ id: 'common', name: 'Cuenta del hogar', scope: 'HOUSEHOLD', balanceCents: 145_000 }]);
    mocks.createAccount.mockResolvedValue({ id: 'new' });
    mocks.updateAccount.mockResolvedValue({ id: 'common' });
    mocks.deleteAccount.mockResolvedValue({ deleted: true });
  });

  it('creating an account refreshes Dashboard coverage and keeps the manual-balance disclosure', async () => {
    const user = userEvent.setup();
    const { client, dashboardKeys } = renderAccounts();
    await user.click(await screen.findByRole('button', { name: 'Añadir cuenta' }));
    await user.type(screen.getByLabelText('Nombre de la cuenta'), 'Cuenta de reserva');
    await user.type(screen.getByLabelText('Saldo actual (€)'), '400');
    await user.click(screen.getByRole('button', { name: 'Guardar cuenta' }));
    await waitFor(() => expect(mocks.createAccount).toHaveBeenCalledWith({ householdId: 'home', body: { name: 'Cuenta de reserva', scope: 'HOUSEHOLD', personalPersonId: null, balanceCents: 40_000 } }));
    await expectCoverageInvalidated(client, dashboardKeys);
    expect(screen.getByText(/Los saldos se introducen manualmente; no hay conexión bancaria automática/)).toBeInTheDocument();
  });

  it('editing the registered balance refreshes every Dashboard variant', async () => {
    const user = userEvent.setup();
    const { client, dashboardKeys } = renderAccounts();
    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Saldo actual (€)'));
    await user.type(screen.getByLabelText('Saldo actual (€)'), '450');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(mocks.updateAccount).toHaveBeenCalledWith({ householdId: 'home', accountId: 'common', body: { name: 'Cuenta del hogar', scope: 'HOUSEHOLD', personalPersonId: null, balanceCents: 45_000 } }));
    await expectCoverageInvalidated(client, dashboardKeys);
  });

  it('removing an account refreshes coverage only after confirming the deletion', async () => {
    const user = userEvent.setup();
    const { client, dashboardKeys } = renderAccounts();
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }));
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar cuenta' }));
    await waitFor(() => expect(mocks.deleteAccount).toHaveBeenCalledWith({ householdId: 'home', accountId: 'common' }));
    await expectCoverageInvalidated(client, dashboardKeys);
  });
});
