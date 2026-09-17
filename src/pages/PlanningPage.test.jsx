import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  plannings: vi.fn(),
  fundPlanning: vi.fn(),
  prepareMonth: vi.fn(),
  updateRecovery: vi.fn(),
  success: vi.fn(),
  household: { currentHousehold: { currency: 'EUR', id: 'household-1' }, isPending: false },
}));

vi.mock('react-hot-toast', () => ({ default: { success: mocks.success, error: vi.fn() } }));

vi.mock('../features/finance/financeService', () => ({
  financeService: {
    dashboard: mocks.dashboard,
    fundPlanning: mocks.fundPlanning,
    plannings: mocks.plannings,
    prepareMonth: mocks.prepareMonth,
    updateRecovery: mocks.updateRecovery,
  },
}));

vi.mock('../features/households/useHousehold', () => ({
  useHousehold: () => mocks.household,
}));

import { PlanningPage } from './PlanningPage';

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const tree = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PlanningPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const result = render(tree());
  return { ...result, client, invalidate, refresh: () => result.rerender(tree()) };
}

describe('PlanningPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.household.currentHousehold = { currency: 'EUR', id: 'household-1' };
    mocks.fundPlanning.mockResolvedValue({ id: 'planning-1', fundingStatus: 'FUNDED' });
    mocks.prepareMonth.mockResolvedValue({ id: 'planning-1' });
    mocks.updateRecovery.mockResolvedValue({ id: 'recovery-1' });
    mocks.dashboard.mockResolvedValue({
      activeRecoveryPlan: { id: 'recovery-1', monthlyAdjustmentCents: 4_000 },
      balanceCents: 90_000,
      budget: {
        contributions: [
          { personId: 'person-1', personName: 'Pablo' },
        ],
        readiness: { ready: true },
        recommendedBudgetCents: 100_000,
      },
      theoreticalReserveCents: 60_000,
    });
    mocks.plannings.mockResolvedValue([
      {
        calculationDate: '2026-09-05',
        contributions: [
          {
            id: 'contribution-1',
            personName: 'Pablo',
            personalExpenseCents: 10_000,
            standardHouseholdCents: 40_000,
            temporaryAdjustmentCents: 2_000,
            totalRecommendedCents: 52_000,
          },
        ],
        fundingStatus: 'PREPARED',
        id: 'planning-1',
        month: 9,
        year: 2026,
      },
    ]);
  });

  it('muestra siempre el desglose estándar, ajuste y total preparado', async () => {
    renderPage();

    expect(await screen.findByText('Último mes preparado')).toBeInTheDocument();
    const contribution = screen.getByRole('article', {
      name: 'Aportación preparada de Pablo',
    });
    expect(within(contribution).getByText('Aportación conjunta')).toBeInTheDocument();
    expect(within(contribution).getByText('Gastos personales')).toBeInTheDocument();
    expect(within(contribution).getByText(/400,00/)).toBeInTheDocument();
    expect(within(contribution).getByText(/100,00/)).toBeInTheDocument();
    expect(within(contribution).getByText('Ajuste conjunto')).toBeInTheDocument();
    expect(within(contribution).getByText(/^20,00/)).toBeInTheDocument();
    expect(within(contribution).getByText('Total a aportar')).toBeInTheDocument();
    expect(within(contribution).getByText(/^520,00/)).toBeInTheDocument();

    expect(screen.getByText('Total calculado')).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de cálculo').parentElement).toHaveClass('min-w-0');
    expect(screen.getByText(/^1040,00/)).toBeInTheDocument();
    expect(screen.getByText(/Confirma los saldos registrados/)).toHaveTextContent('no representa el presupuesto que queda por utilizar ni una consulta a tu banco');
    expect(screen.queryByText(/en números rojos/i)).not.toBeInTheDocument();
  });

  it('no vuelve a pedir los saldos cuando el mes actual ya está confirmado', async () => {
    mocks.dashboard.mockResolvedValue({
      balanceCents: 90_000,
      budget: {
        contributions: [{ personId: 'person-1', personName: 'Pablo' }],
        readiness: { ready: true },
        recommendedBudgetCents: 100_000,
      },
      planning: {
        calculationDate: '2026-09-05',
        contributions: [],
        fundingStatus: 'FUNDED',
        id: 'planning-current',
        month: 9,
        year: 2026,
      },
      theoreticalReserveCents: 60_000,
    });

    renderPage();

    expect(await screen.findByText('Este mes ya está calculado')).toBeInTheDocument();
    expect(screen.queryByText('Confirmar saldos del mes')).not.toBeInTheDocument();
    expect(screen.getByText(/Las aportaciones se calcularon/)).toHaveTextContent('Consulta en Inicio el presupuesto restante');
  });

  it('explica el presupuesto actualizado sin volver a confirmar saldos ni sobrescribir la preparación', async () => {
    mocks.dashboard.mockResolvedValue({
      budget: { contributions: [], readiness: { ready: true }, recommendedBudgetCents: 105000 },
      planning: { id: 'current', calculationDate: '2026-09-05', month: 9, year: 2026, contributions: [], fundingStatus: 'FUNDED', budgetChangedSincePreparation: true },
    });
    renderPage();
    const notice = await screen.findByText(/El presupuesto ha cambiado desde que preparaste el mes/);
    expect(notice).toHaveTextContent('El presupuesto ha cambiado');
    expect(notice).toHaveTextContent('Conservamos los saldos confirmados y el registro de preparación original');
    expect(screen.queryByText('Confirmar saldos del mes')).not.toBeInTheDocument();
    expect(mocks.prepareMonth).not.toHaveBeenCalled();
  });

  it('explica la ocultación de datos personales históricos de preparaciones antiguas', async () => {
    mocks.plannings.mockResolvedValue([{ id: 'legacy', contributions: [], fundingStatus: 'FUNDED', calculationDate: '2026-09-05', personalHistoryRequiresConfirmation: true }]);
    renderPage();
    expect(await screen.findByText(/Sus datos originales se conservan, pero por privacidad/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Actualiza tu saldo en Cuentas' })).toHaveAttribute('href', '/cuentas');
  });

  it('confirmar saldos recalcula todas las variantes del Dashboard', async () => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Confirmar saldos y calcular mes' }));
    await waitFor(() => expect(mocks.prepareMonth).toHaveBeenCalledWith(expect.objectContaining({
      householdId: 'household-1',
      body: expect.objectContaining({ confirmedBalanceCents: 90_000 }),
    })));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'] }));
  });

  it.each([
    ['Confirmar fondos del mes', 'fundPlanning'],
    ['Marcar como recuperado', 'updateRecovery'],
  ])('%s refresca el Dashboard tras guardar', async (action, mutation) => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();
    await user.click(await screen.findByRole('button', { name: action }));
    await waitFor(() => expect(mocks[mutation]).toHaveBeenCalledOnce());
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'] }));
  });

  it('cambiar de hogar descarta saldos y fecha anteriores antes de preparar el nuevo mes', async () => {
    const user = userEvent.setup();
    const { refresh } = renderPage();
    const originalDate = (await screen.findByLabelText('Fecha de cálculo')).value;
    await user.clear(screen.getByLabelText('Saldo de la cuenta conjunta'));
    await user.type(screen.getByLabelText('Saldo de la cuenta conjunta'), '1234');
    await user.clear(screen.getByLabelText('Saldo personal de Pablo'));
    await user.type(screen.getByLabelText('Saldo personal de Pablo'), '987');
    await user.clear(screen.getByLabelText('Fecha de cálculo'));
    await user.type(screen.getByLabelText('Fecha de cálculo'), '2025-01-01');
    mocks.dashboard.mockResolvedValue({ balanceCents: 12000, accountSummary: { personal: [{ personId: 'person-2', balanceCents: 5000 }] }, budget: { contributions: [{ personId: 'person-2', personName: 'Ana' }], readiness: { ready: true }, recommendedBudgetCents: 100000 } });
    mocks.plannings.mockResolvedValue([]);
    mocks.household.currentHousehold = { currency: 'EUR', id: 'household-2' };
    refresh();
    await waitFor(() => expect(screen.getByLabelText('Saldo de la cuenta conjunta')).toHaveValue('120,00'));
    expect(screen.getByLabelText('Saldo personal de Ana')).toHaveValue('50,00');
    expect(screen.queryByLabelText('Saldo personal de Pablo')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de cálculo')).toHaveValue(originalDate);
    await user.click(screen.getByRole('button', { name: 'Confirmar saldos y calcular mes' }));
    await waitFor(() => expect(mocks.prepareMonth).toHaveBeenCalledWith({ householdId: 'household-2', body: { calculationDate: originalDate, confirmedBalanceCents: 12000, confirmedPersonalBalances: [{ personId: 'person-2', balanceCents: 5000 }] } }));
  });

  it('una respuesta tardía del hogar anterior no muestra éxito ni refresca el hogar actual', async () => {
    const user = userEvent.setup();
    let resolve;
    mocks.prepareMonth.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { invalidate, refresh } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Confirmar saldos y calcular mes' }));
    await waitFor(() => expect(mocks.prepareMonth).toHaveBeenCalledOnce());
    mocks.household.currentHousehold = { currency: 'EUR', id: 'household-2' };
    refresh();
    expect(await screen.findByRole('button', { name: 'Confirmar saldos y calcular mes' })).toBeEnabled();
    await act(async () => resolve({ id: 'saved-old-household' }));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'], refetchType: 'none' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['plannings', 'household-1'], refetchType: 'none' });
    expect(invalidate.mock.calls.some(([options]) => options.queryKey[1] === 'household-2')).toBe(false);
  });
});
