import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ list: vi.fn(), listPeople: vi.fn(), accounts: vi.fn(), createAccount: vi.fn(), updateAccount: vi.fn(), deleteAccount: vi.fn(), simulation: vi.fn(), update: vi.fn(), error: vi.fn() }));
vi.mock('../features/households/householdService', () => ({ householdService: mocks }));
vi.mock('../features/finance/financeService', () => ({ financeService: mocks }));
vi.mock('../features/households/CategoryManager', () => ({ CategoryManager: () => null }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: mocks.error } }));

import { HouseholdProvider } from '../features/households/HouseholdProvider';
import { useHousehold } from '../features/households/useHousehold';
import { AccountsPage } from './AccountsPage';
import { SettingsPage } from './SettingsPage';
import { SimulatorPage } from './SimulatorPage';

function Harness({ Page }) {
  const { currentHousehold, selectHousehold } = useHousehold();
  return <><p>Hogar actual: {currentHousehold?.id}</p><button onClick={() => selectHousehold('two')}>Cambiar a segundo hogar</button><Page /></>;
}
function setup(Page) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const result = render(<QueryClientProvider client={client}><MemoryRouter><HouseholdProvider><Harness Page={Page} /></HouseholdProvider></MemoryRouter></QueryClientProvider>);
  return { ...result, client, invalidate };
}
describe('household-scoped drafts and financial preferences', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    mocks.list.mockResolvedValue([
      { id: 'one', currency: 'EUR', safetyMarginBps: 1000, access: { role: 'OWNER' } },
      { id: 'two', currency: 'EUR', safetyMarginBps: 2000, access: { role: 'OWNER' } },
    ]);
    mocks.listPeople.mockResolvedValue({ people: [] });
    mocks.accounts.mockImplementation((id) => Promise.resolve([{ id: `account-${id}`, name: `Cuenta ${id}`, scope: 'HOUSEHOLD', balanceCents: 10000 }]));
    mocks.simulation.mockResolvedValue({ readiness: { ready: true }, deficitCents: 0, financialStatus: 'OK', monthlyStandardBudgetCents: 10000, theoreticalReserveCents: 1000, relevantAvailableBalanceCents: 10000 });
  });
  afterEach(() => vi.restoreAllMocks());

  it('cancel keeps an account edit; accepting discards its ID and all fields', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    setup(AccountsPage);
    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Nombre de la cuenta'));
    await user.type(screen.getByLabelText('Nombre de la cuenta'), 'Borrador privado');
    await user.click(screen.getByText('Cambiar a segundo hogar'));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Nombre de la cuenta')).toHaveValue('Borrador privado');
    expect(screen.getByText('Hogar actual: one')).toBeVisible();
    confirm.mockReturnValue(true);
    await user.click(screen.getByText('Cambiar a segundo hogar'));
    await screen.findByText('Cuenta two');
    expect(screen.queryByLabelText('Nombre de la cuenta')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Añadir cuenta' }));
    expect(screen.getByLabelText('Nombre de la cuenta')).toHaveValue('');
    expect(screen.getByLabelText('Saldo actual (€)')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Guardar cuenta' })).toBeVisible();
    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it('does not carry an applied simulation date or balance to the next household', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    setup(SimulatorPage);
    const dateInput = await screen.findByLabelText('Fecha a simular');
    const today = dateInput.value;
    fireEvent.change(dateInput, { target: { value: '2030-12-29' } });
    await user.type(screen.getByLabelText('Saldo alternativo (opcional)'), '1234');
    await user.click(screen.getByRole('button', { name: 'Actualizar simulación' }));
    await waitFor(() => expect(mocks.simulation).toHaveBeenLastCalledWith('one', '2030-12-29', 123400));
    await user.click(screen.getByText('Cambiar a segundo hogar'));
    await waitFor(() => expect(mocks.simulation).toHaveBeenLastCalledWith('two', today, undefined));
    expect(await screen.findByLabelText('Saldo alternativo (opcional)')).toHaveValue('');
    expect(screen.getByLabelText('Fecha a simular')).toHaveValue(today);
    expect(confirm).toHaveBeenCalledOnce();
  });

  it('blocks household switches during an account save and releases the guard after success', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let resolveSave;
    mocks.updateAccount.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    setup(AccountsPage);
    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await user.click(screen.getByText('Cambiar a segundo hogar'));
    expect(screen.getByText('Hogar actual: one')).toBeVisible();
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Espera'));
    expect(confirm).not.toHaveBeenCalled();
    await act(async () => resolveSave({}));
    await waitFor(() => expect(screen.queryByLabelText('Nombre de la cuenta')).not.toBeInTheDocument());
    await user.click(screen.getByText('Cambiar a segundo hogar'));
    expect(await screen.findByText('Cuenta two')).toBeVisible();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('resets a margin draft to the selected household and refreshes every financial view on save', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.update.mockResolvedValue({});
    const { invalidate } = setup(SettingsPage);
    await user.clear(await screen.findByLabelText('Porcentaje de margen'));
    await user.type(screen.getByLabelText('Porcentaje de margen'), '35');
    await user.click(screen.getByText('Cambiar a segundo hogar'));
    expect(screen.getByLabelText('Porcentaje de margen')).toHaveValue('20');
    await user.clear(screen.getByLabelText('Porcentaje de margen'));
    await user.type(screen.getByLabelText('Porcentaje de margen'), '0');
    await user.click(screen.getByRole('button', { name: 'Guardar margen' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ householdId: 'two', body: { safetyMarginBps: 0 } }));
    for (const prefix of ['dashboard', 'budget', 'simulation', 'calendar', 'plannings', 'monthlyPlanning', 'invoiceStatistics', 'variableStatistics', 'householdCategories']) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [prefix, 'two'] });
    }
  });

  it('reports a failed margin save and keeps the draft for retry', async () => {
    const user = userEvent.setup();
    mocks.update.mockRejectedValue(new Error('No se pudo guardar el margen'));
    setup(SettingsPage);
    await user.clear(await screen.findByLabelText('Porcentaje de margen'));
    await user.type(screen.getByLabelText('Porcentaje de margen'), '12,5');
    await user.click(screen.getByRole('button', { name: 'Guardar margen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
    expect(screen.getByLabelText('Porcentaje de margen')).toHaveValue('12,5');
  });
});
