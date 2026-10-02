import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { financeService } from '../features/finance/financeService';
import { invalidateBudgetQueries } from '../features/finance/invalidateBudgetQueries';
import { invalidatePaymentQueries } from '../features/finance/paymentOccurrence';
import { HouseholdContext } from '../features/households/householdStateContext';
import { invalidatePurchasePaymentQueries } from '../features/purchases/purchasePaymentsService';
import { invalidatePurchaseQueries } from '../features/purchases/invalidatePurchaseQueries';
import { DashboardPage } from './DashboardPage';

vi.mock('../features/finance/financeService', () => ({ financeService: { dashboard: vi.fn() } }));
const household = { currency: 'EUR', id: 'household-1', name: 'Casa' };
const overview = (overrides = {}) => ({
  balanceCents: 200000, balanceSource: 'ACCOUNTS', expectedCents: 104000,
  paidCents: 20000, unconfirmedCents: 60000, estimatedCents: 24000,
  remainingCents: 84000, projectedBalanceCents: 116000,
  lines: [
    { id: 'rent', name: 'Alquiler', type: 'RECURRING', date: '2026-09-01', status: 'UNCONFIRMED', amountCents: 60000 },
    { id: 'shop', name: 'Compra semanal', type: 'VARIABLE', date: '2026-09-03', status: 'PAID', amountCents: 20000 },
    { id: 'estimate', name: 'Supermercado', type: 'VARIABLE', status: 'ESTIMATED', amountCents: 24000, basisTotalCents: 44000, recordedCents: 20000, allowanceCents: 4000 },
  ], ...overrides,
});
function dashboardData(overrides = {}) {
  return {
    household, calculationDate: '2026-09-17', budget: { readiness: { ready: true } }, planning: null,
    // Old recommendation-minus-spending and stale preparation must not drive Inicio.
    balanceCents: 999, monthlyProgress: { common: { budgetCents: 143917, usedCents: 75580, remainingCents: 68337 } },
    monthlyOverview: { common: overview(), personal: null }, ...overrides,
  };
}
function renderDashboard(householdOverrides = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(<QueryClientProvider client={client}>
    <HouseholdContext.Provider value={{ currentHousehold: household, isPending: false, isError: false, ...householdOverrides }}>
      <MemoryRouter><DashboardPage /></MemoryRouter>
    </HouseholdContext.Provider>
  </QueryClientProvider>);
  return { ...result, client };
}
const amount = (region, label) => within(region).getByText(label, { exact: true }).parentElement.querySelector('dd');

describe('Inicio: saldo y gastos del mes', () => {
  beforeEach(() => { vi.clearAllMocks(); financeService.dashboard.mockResolvedValue(dashboardData()); });

  it('shows bank balance separately from monthly expenses, confirmed payments and the remaining forecast, without a progress bar', async () => {
    renderDashboard();
    const card = await screen.findByRole('region', { name: 'Cuenta conjunta' });
    expect(within(card).getByText('2000,00 €')).toBeVisible();
    expect(amount(card, 'Previsto gastar en total')).toHaveTextContent('1040,00');
    expect(amount(card, 'Ya confirmado como pagado')).toHaveTextContent('200,00');
    expect(amount(card, 'Falta pagar o confirmar')).toHaveTextContent('840,00');
    expect(within(card).getByText('1160,00 €')).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/Margen del presupuesto|683,37|1439,17|755,80/)).not.toBeInTheDocument();
    expect(screen.getByText(/no una conexión con tu banco/)).toBeVisible();
    expect(screen.getByText(/Si ya pagaste algo pero no lo has confirmado/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Actualizar saldos' })).toHaveAttribute('href', '/cuentas');
  });

  it('lets the user follow the arithmetic and inspect each expense and estimate with keyboard-accessible disclosures', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole('region', { name: 'Cuenta conjunta' });
    const explanation = screen.getByText(/Saldo anotado 2000,00/);
    expect(explanation).not.toBeVisible();
    await user.click(screen.getByText('Ver de dónde sale cada importe'));
    expect(explanation).toBeVisible();
    expect(explanation).toHaveTextContent('− pendiente 840,00 € = 1160,00 €');
    expect(screen.getByText('Compra semanal')).not.toBeVisible();
    const variables = screen.getByText('Gastos variables').closest('summary');
    variables.focus();
    await user.keyboard('{Enter}');
    // jsdom does not implement native summary keyboard activation; click tests
    // the native disclosure while the element remains focusable and semantic.
    if (!variables.parentElement.open) await user.click(variables);
    expect(screen.getByText('Compra semanal')).toBeVisible();
    expect(screen.getByText(/440,00 € previstos/)).toHaveTextContent('40,00 € de colchón configurado');
    expect(screen.getByText(/440,00 € previstos/)).toHaveTextContent('− 200,00 € registrados = 240,00 €');
    expect(screen.getByText('Estimación, no es un recibo')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Revisar gastos y confirmar pagos' })).toHaveAttribute('href', '/calendario');
  });

  it('keeps personal funds separate and never replaces a missing current balance with historical planning', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ monthlyOverview: {
      common: overview(), personal: overview({ balanceCents: null, balanceSource: null, projectedBalanceCents: null, expectedCents: 1000, paidCents: 0, remainingCents: 1000, estimatedCents: 0, lines: [] }),
    }, planning: { fundingStatus: 'FUNDED', contributions: [{ confirmedPersonalBalanceCents: 999999 }] } }));
    renderDashboard();
    const personal = await screen.findByRole('region', { name: 'Tus cuentas personales' });
    expect(within(personal).getByText('Sin saldo registrado')).toBeVisible();
    expect(within(personal).queryByText('Después de lo pendiente, quedarían')).not.toBeInTheDocument();
    expect(screen.queryByText(/9999,99/)).not.toBeInTheDocument();
    expect(within(personal).getByText(/No usamos un saldo antiguo/)).toBeVisible();
    expect(amount(personal, 'Previsto gastar en total')).toHaveTextContent('10,00');
  });

  it('warns about a shortfall without presenting it as a required transfer or mixing personal and joint money', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ monthlyOverview: {
      common: overview({ balanceCents: 20000, projectedBalanceCents: -64000 }),
      personal: overview({ balanceCents: 500000, projectedBalanceCents: 500000, expectedCents: 0, paidCents: 0, remainingCents: 0, estimatedCents: 0, lines: [] }),
    } }));
    renderDashboard();
    const common = await screen.findByRole('region', { name: 'Cuenta conjunta' });
    expect(within(common).getByText('Con ese saldo, faltarían')).toBeVisible();
    expect(within(common).getByText('640,00 €')).toBeVisible();
    const personal = screen.getByRole('region', { name: 'Tus cuentas personales' });
    expect(within(personal).getByText(/No descuenta tu aportación a la cuenta conjunta/)).toBeVisible();
  });

  it('does not claim all funds are confirmed when agreed extras remain', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ planning: { fundingStatus: 'FUNDED', extraFunding: { pendingCents: 4000 }, budgetChangedSincePreparation: true } }));
    renderDashboard();
    expect(await screen.findByText('Hay aportaciones extra pendientes de ingresar.')).toBeVisible();
    expect(screen.queryByText(/Las aportaciones preparadas de este mes están confirmadas/)).not.toBeInTheDocument();
    expect(screen.getByText(/las aportaciones guardadas no se han cambiado/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ver aportaciones de este mes' })).toHaveAttribute('href', '/planificacion?mes=2026-09');
  });

  it('offers separate current-month and next-month preparation, including December rollover', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ calculationDate: '2026-12-29' }));
    renderDashboard();
    expect(await screen.findByRole('link', { name: 'Preparar aportaciones de este mes' })).toHaveAttribute('href', '/planificacion?mes=2026-12');
    expect(screen.getByRole('link', { name: 'Preparar enero de 2027' })).toHaveAttribute('href', '/planificacion?mes=2027-01');
  });

  it('keeps useful registered data visible when the contribution distribution is incomplete', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ budget: { readiness: { ready: false } } }));
    renderDashboard();
    expect(await screen.findByText(/la estimación mensual aún está incompleta/)).toBeVisible();
    expect(screen.getByRole('region', { name: 'Cuenta conjunta' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Completar reparto' })).toHaveAttribute('href', '/hogar');
    expect(screen.queryByText('Después de lo pendiente, quedarían')).not.toBeInTheDocument();
    expect(screen.getByText('Gastos conocidos (previsión incompleta)')).toBeVisible();
  });

  it('explains an empty month instead of promising there will be no payments', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ monthlyOverview: { common: overview({ expectedCents: 0, paidCents: 0, remainingCents: 0, estimatedCents: 0, projectedBalanceCents: 200000, lines: [] }), personal: null } }));
    const user = userEvent.setup(); renderDashboard();
    await user.click(await screen.findByText('Ver de dónde sale cada importe'));
    expect(screen.getByText(/Esto no garantiza que no vaya a haber pagos/)).toBeVisible();
  });

  it('does not query without a household or invent amounts', () => {
    renderDashboard({ currentHousehold: null });
    expect(screen.getByRole('link', { name: 'Crear mi hogar' })).toHaveAttribute('href', '/hogar');
    expect(financeService.dashboard).not.toHaveBeenCalled();
  });

  it('handles loading and a recoverable server error', async () => {
    let reject;
    financeService.dashboard.mockReturnValueOnce(new Promise((resolve, rejectPromise) => { reject = rejectPromise; }));
    const user = userEvent.setup(); renderDashboard();
    expect(screen.getByText('Cargando cuentas y gastos del mes')).toBeVisible();
    await act(async () => reject(new Error('Sin conexión')));
    expect(await screen.findByText('Sin conexión')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Reintentar|Volver a intentar/ }));
    expect(await screen.findByRole('region', { name: 'Cuenta conjunta' })).toBeVisible();
  });

  it('reports a missing new API block instead of silently falling back to the misleading old calculation', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ monthlyOverview: undefined }));
    renderDashboard();
    expect(await screen.findByText('Resumen mensual no disponible')).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it.each([
    ['accounts and expenses', (client) => invalidateBudgetQueries(client, household.id)],
    ['recurring payments', (client) => invalidatePaymentQueries(client, household.id, 'rent')],
    ['purchase payments', (client) => invalidatePurchasePaymentQueries(client, household.id, 'purchase')],
    ['purchase changes', (client) => invalidatePurchaseQueries(client, household.id, 'purchase')],
  ])('refreshes the visible remaining amount after changes to %s', async (name, invalidate) => {
    const { client } = renderDashboard();
    const common = await screen.findByRole('region', { name: 'Cuenta conjunta' });
    financeService.dashboard.mockResolvedValue(dashboardData({ monthlyOverview: { common: overview({ paidCents: 80000, remainingCents: 24000, projectedBalanceCents: 176000 }), personal: null } }));
    await act(async () => invalidate(client));
    await waitFor(() => expect(amount(common, 'Falta pagar o confirmar')).toHaveTextContent('240,00'));
    expect(within(common).getByText('1760,00 €')).toBeVisible();
  });
});
