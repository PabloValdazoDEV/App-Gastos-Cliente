import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(), fundPlanning: vi.fn(), prepareMonth: vi.fn(), updateRecovery: vi.fn(), success: vi.fn(),
  household: { currentHousehold: { currency: 'EUR', id: 'household-1' }, isPending: false },
}));
vi.mock('react-hot-toast', () => ({ default: { success: mocks.success, error: vi.fn() } }));
vi.mock('../features/finance/financeService', () => ({ financeService: mocks }));
vi.mock('../features/households/useHousehold', () => ({ useHousehold: () => mocks.household }));
vi.mock('./expensePageUtils', () => ({ todayIso: () => '2026-10-29' }));
import { PlanningPage } from './PlanningPage';

function forecast(overrides = {}) {
  return { balanceCents: 90000, budget: { contributions: [{ personId: 'person-1', personName: 'Pablo' }],
    readiness: { ready: true }, recommendedBudgetCents: 100000,
    lines: [{ id: 'extra', name: 'Compra noviembre', type: 'ONE_TIME', scope: 'HOUSEHOLD', amountCents: 11000, baseCents: 10000 }] }, ...overrides };
}
function planning(overrides = {}) {
  return { id: 'planning-1', calculationDate: '2026-11-01', month: 11, year: 2026, fundingStatus: 'PREPARED',
    contributions: [{ id: 'c1', householdPersonId: 'person-1', personName: 'Pablo', personalExpenseCents: 10000,
      standardHouseholdCents: 40000, temporaryAdjustmentCents: 2000, totalRecommendedCents: 52000,
      canConfirmPersonal: true, funding: { pendingCents: 52000, confirmedCents: 0, commonConfirmed: false, personalConfirmed: false } }], ...overrides };
}
function renderPage(entry = '/planificacion') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const tree = () => <QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}><PlanningPage /></MemoryRouter></QueryClientProvider>;
  const result = render(tree());
  return { ...result, client, invalidate, refresh: () => result.rerender(tree()) };
}
describe('PlanningPage salary month forecast', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.household.currentHousehold = { currency: 'EUR', id: 'household-1' };
    mocks.dashboard.mockResolvedValue(forecast());
    mocks.prepareMonth.mockResolvedValue({ id: 'planning-1' });
    mocks.fundPlanning.mockResolvedValue({ id: 'planning-1' });
    mocks.updateRecovery.mockResolvedValue({});
  });
  it('keeps the initial amount fixed and includes extras in confirmed and pending totals', async () => {
    const saved = planning({ fundingStatus: 'FUNDED', extraFunding: { agreedCents: 8000, pendingCents: 4000 } });
    saved.contributions[0] = { ...saved.contributions[0], extraFunding: { agreedCents: 8000, pendingCents: 4000 }, totalConfirmedCents: 56000, totalPendingCents: 4000 };
    mocks.dashboard.mockResolvedValue(forecast({ planning: saved }));
    renderPage();
    const card = await screen.findByRole('article', { name: 'Aportación preparada de Pablo' });
    expect(within(card).getByText('Aportación prevista guardada').nextElementSibling).toHaveTextContent('520,00');
    expect(within(card).getByText('Extra conjunto acordado').nextElementSibling).toHaveTextContent('80,00');
    expect(within(card).getByText('Ya confirmado').nextElementSibling).toHaveTextContent('560,00');
    expect(within(card).getByText('Pendiente de aportar').nextElementSibling).toHaveTextContent('40,00');
    expect(screen.getByText('Aportación inicial confirmada · Extras pendientes')).toBeVisible();
    expect(screen.queryByText('Fondos del mes confirmados')).not.toBeInTheDocument();
  });
  it('salary in October defaults to November 1–30, with matching preview and saved request', async () => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();
    expect(screen.getByLabelText('Mes a financiar')).toHaveValue('2026-11');
    expect(screen.getByText(/del día 1 al 30/)).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Guardar previsión del mes' }));
    expect(mocks.dashboard).toHaveBeenCalledWith('household-1', '2026-11-01');
    await waitFor(() => expect(mocks.prepareMonth).toHaveBeenCalledWith({
      householdId: 'household-1', body: { calculationDate: '2026-11-01', confirmedBalanceCents: 90000,
        confirmedPersonalBalances: [{ personId: 'person-1', balanceCents: 0 }] },
    }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'] });
    expect(screen.getByText(/no se descuentan automáticamente/)).toBeVisible();
  });
  it('shows extraordinary expenses and their included margin in the breakdown', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByText('Desglose de la previsión'));
    expect(screen.getByText('Compra noviembre')).toBeVisible();
    expect(screen.getByText(/Extraordinario del mes/)).toBeVisible();
    expect(screen.getByText(/Incluye 10,00/)).toBeVisible();
  });
  it('labels an estimated variable month closing in the saved breakdown without claiming it is final', async () => {
    const user = userEvent.setup();
    mocks.dashboard.mockResolvedValue(forecast({ planning: planning({ budgetLines: [{ id: 'food', name: 'Supermercado', type: 'VARIABLE', scope: 'HOUSEHOLD', baseCents: 50000, amountCents: 55000, estimatedClosingMonth: '2026-10' }] }) }));
    renderPage();
    await user.click(await screen.findByText('Desglose de la previsión'));
    expect(screen.getByText(/La media incluye octubre de 2026 como cierre estimado/)).toBeVisible();
    expect(screen.getByText(/No es un cierre definitivo/)).toBeVisible();
    expect(screen.getByText(/Incluye 50,00/)).toBeVisible();
  });
  it('keeps frozen contributions and displays changes separately, not as new transfers', async () => {
    const user = userEvent.setup();
    mocks.dashboard.mockResolvedValue(forecast({ planning: planning({ budgetChangedSincePreparation: true,
      budgetComparison: { householdDifferenceCents: 8000, personalDifferenceCents: 0, lines: [{ id: 'new', name: 'Factura nueva', previousCents: 0, currentCents: 8000 }] } }) }));
    renderPage();
    expect(await screen.findByText('Previsión del mes guardada')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Guardar previsión del mes' })).not.toBeInTheDocument();
    const card = screen.getByRole('article', { name: 'Aportación preparada de Pablo' });
    expect(within(card).getByText('Aportación prevista guardada')).toBeVisible();
    expect(within(card).getAllByText(/520,00/)).toHaveLength(2);
    expect(screen.getByText('Hay cambios en los gastos; tus aportaciones guardadas se mantienen.')).toBeVisible();
    expect(screen.getByText(/Conservamos las aportaciones originales/)).not.toBeVisible();
    expect(screen.getByText(/Factura nueva:/)).not.toBeVisible();
    await user.click(screen.getByText('Ver cambios'));
    expect(screen.getByText(/Conservamos las aportaciones originales/)).toBeVisible();
    expect(screen.getByText(/Factura nueva:/)).toBeVisible();
    await user.click(screen.getByText('Ver cambios'));
    expect(screen.getByText(/Factura nueva:/)).not.toBeVisible();
    expect(within(card).getAllByText(/520,00/)).toHaveLength(2);
    expect(mocks.prepareMonth).not.toHaveBeenCalled();
    expect(mocks.fundPlanning).not.toHaveBeenCalled();
  });
  it('keeps a negative deviation and unavailable personal history inside the optional disclosure', async () => {
    const user = userEvent.setup();
    mocks.dashboard.mockResolvedValue(forecast({ planning: planning({ revision: 2, budgetChangedSincePreparation: true,
      budgetComparison: { householdDifferenceCents: -6817, personalDifferenceCents: null, lines: [{ id: 'water', name: 'Agua', previousCents: 1835, currentCents: 1668 }] } }) }));
    renderPage();
    const summary = await screen.findByText('Ver cambios');
    expect(summary.closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText(/Diferencia conjunta:/)).not.toBeVisible();
    await user.click(summary);
    expect(screen.getByText(/Diferencia conjunta:/)).toHaveTextContent('-68,17 €');
    expect(screen.getByText(/Diferencia conjunta:/)).toHaveTextContent('histórico no disponible');
    expect(screen.getByText(/Conservamos las aportaciones de la revisión guardada/)).toBeVisible();
    expect(screen.getByText(/Agua:/)).toBeVisible();
  });
  it('shows only the compact saved notice when there are no changes to review', async () => {
    mocks.dashboard.mockResolvedValue(forecast({ planning: planning() }));
    renderPage();
    expect(await screen.findByText('Previsión del mes guardada')).toBeVisible();
    expect(screen.getByText('Tus aportaciones guardadas se mantienen.')).toBeVisible();
    expect(screen.queryByText('Ver cambios')).not.toBeInTheDocument();
  });
  it.each([
    ['Confirmar todas las transferencias conjuntas realizadas', 'HOUSEHOLD'],
    ['Confirmar mi aportación personal realizada', 'PERSONAL'],
  ])('confirms %s independently and invalidates all dashboard variants', async (label, scope) => {
    const user = userEvent.setup();
    mocks.dashboard.mockResolvedValue(forecast({ planning: planning() }));
    const { invalidate } = renderPage();
    await user.click(await screen.findByRole('button', { name: label }));
    await waitFor(() => expect(mocks.fundPlanning).toHaveBeenCalledWith({ householdId: 'household-1', planningId: 'planning-1', scope }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'] });
  });
  it('funded plans show zero pending and no duplicate confirmation buttons', async () => {
    const saved = planning({ fundingStatus: 'FUNDED' });
    saved.contributions[0].funding = { confirmedCents: 52000, pendingCents: 0, commonConfirmed: true, personalConfirmed: true };
    mocks.dashboard.mockResolvedValue(forecast({ planning: saved }));
    renderPage();
    expect(await screen.findByText('Fondos del mes confirmados')).toBeVisible();
    const card = screen.getByRole('article', { name: 'Aportación preparada de Pablo' });
    expect(within(card).getByText('Pendiente de aportar').nextElementSibling).toHaveTextContent('0,00');
    expect(screen.queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument();
  });
  it('reports funding failures without pretending success', async () => {
    const user = userEvent.setup();
    mocks.dashboard.mockResolvedValue(forecast({ planning: planning() }));
    mocks.fundPlanning.mockRejectedValue(new Error('No se ha podido guardar la confirmación.'));
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Confirmar mi aportación personal realizada' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido guardar');
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it('month switch clears balances, uses isolated cache keys and never falls back to another saved month', async () => {
    const user = userEvent.setup();
    mocks.dashboard.mockImplementation((_id, date) => Promise.resolve(date === '2026-12-01' ? forecast({ planning: planning({ month: 12 }) }) : forecast()));
    renderPage();
    await user.clear(await screen.findByLabelText('Saldo de la cuenta conjunta'));
    await user.type(screen.getByLabelText('Saldo de la cuenta conjunta'), '1234');
    fireEvent.change(screen.getByLabelText('Mes a financiar'), { target: { value: '2026-12' } });
    expect(await screen.findByText('Previsión del mes guardada')).toBeVisible();
    expect(screen.queryByLabelText('Saldo de la cuenta conjunta')).not.toBeInTheDocument();
    expect(mocks.dashboard).toHaveBeenCalledWith('household-1', '2026-12-01');
    fireEvent.change(screen.getByLabelText('Mes a financiar'), { target: { value: '2026-11' } });
    await waitFor(() => expect(screen.getByLabelText('Saldo de la cuenta conjunta')).toHaveValue('900,00'));
    expect(screen.queryByText('Transferencias del mes seleccionado')).not.toBeInTheDocument();
  });
  it('household switch clears the selected month and all entered balances', async () => {
    const user = userEvent.setup();
    const { refresh } = renderPage();
    await user.clear(await screen.findByLabelText('Saldo personal de Pablo'));
    await user.type(screen.getByLabelText('Saldo personal de Pablo'), '987');
    fireEvent.change(screen.getByLabelText('Mes a financiar'), { target: { value: '2025-01' } });
    mocks.dashboard.mockResolvedValue(forecast({ balanceCents: 12000 }));
    mocks.household.currentHousehold = { currency: 'EUR', id: 'household-2' };
    refresh();
    await waitFor(() => expect(screen.getByLabelText('Saldo de la cuenta conjunta')).toHaveValue('120,00'));
    expect(screen.getByLabelText('Saldo personal de Pablo')).toHaveValue('0,00');
    expect(screen.getByLabelText('Mes a financiar')).toHaveValue('2026-11');
  });
  it('late response for a different month does not toast or refetch active forms', async () => {
    const user = userEvent.setup();
    let resolve;
    mocks.prepareMonth.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { invalidate } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Guardar previsión del mes' }));
    await waitFor(() => expect(mocks.prepareMonth).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Mes a financiar'), { target: { value: '2026-12' } });
    expect(await screen.findByRole('button', { name: 'Guardar previsión del mes' })).toBeEnabled();
    await act(async () => resolve({}));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'], refetchType: 'none' });
  });
  it('supports explicit current-month links and hides personal confirmations for legacy identity', async () => {
    mocks.dashboard.mockResolvedValue(forecast({ planning: planning({ personalHistoryRequiresConfirmation: true, contributions: [] }) }));
    renderPage('/planificacion?mes=2026-10');
    expect(await screen.findByText(/Sus datos originales se conservan, pero por privacidad/)).toBeVisible();
    expect(mocks.dashboard).toHaveBeenCalledWith('household-1', '2026-10-01');
    expect(screen.getByLabelText('Mes a financiar')).toHaveValue('2026-10');
    expect(screen.queryByRole('button', { name: 'Confirmar mi aportación personal realizada' })).not.toBeInTheDocument();
  });
});
