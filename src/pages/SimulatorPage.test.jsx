import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createRecovery: vi.fn(),
  simulation: vi.fn(),
}));

vi.mock('../features/finance/financeService', () => ({
  financeService: {
    createRecovery: mocks.createRecovery,
    previewRecovery: vi.fn(),
    simulation: mocks.simulation,
  },
}));

vi.mock('../features/households/useHousehold', () => ({
  useHousehold: () => ({
    currentHousehold: { currency: 'EUR', id: 'household-1' },
    isPending: false,
  }),
}));

import { SimulatorPage } from './SimulatorPage';

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SimulatorPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SimulatorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRecovery.mockResolvedValue({ monthlyAdjustmentCents: 15_000 });
    mocks.simulation.mockResolvedValue({
      deficitCents: 0,
      financialStatus: 'PAYMENT_RISK',
      monthlyStandardBudgetCents: 100_000,
      readiness: { ready: true },
      relevantAvailableBalanceCents: 30_000,
      reserveLines: [
        {
          daysRemaining: 10,
          dueDate: '2026-09-20',
          expenseId: 'reserve-1',
          name: 'Seguro del coche',
          overdue: false,
          reserveCents: 45_000,
          targetAmountCents: 90_000,
        },
      ],
      simulationDate: '2026-09-10',
      theoreticalReserveCents: 45_000,
      upcomingPayments: [
        {
          amountCents: 40_000,
          daysRemaining: 2,
          dueDate: '2026-09-12',
          expenseId: 'payment-1',
          name: 'Alquiler',
          scope: 'HOUSEHOLD',
        },
      ],
    });
  });

  it('muestra estado, riesgo, días restantes, pagos y líneas de reserva', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Riesgo de próximo pago' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Estado API: PAYMENT_RISK')).toBeInTheDocument();
    expect(screen.getByText('Alquiler')).toBeInTheDocument();
    expect(screen.getByText(/Quedan 2 días/)).toBeInTheDocument();
    expect(screen.getByText('Seguro del coche')).toBeInTheDocument();
    expect(screen.getByText(/Quedan 10 días/)).toBeInTheDocument();
    expect(screen.getByText('Reservado a fecha')).toBeInTheDocument();
    expect(screen.getByText('Objetivo')).toBeInTheDocument();
  });

  it('compara la aportación inmediata antes de proponer repartir el déficit', async () => {
    mocks.simulation.mockResolvedValueOnce({
      deficitCents: 15_000,
      financialStatus: 'DEFICIT',
      monthlyStandardBudgetCents: 100_000,
      readiness: { ready: true },
      relevantAvailableBalanceCents: 30_000,
      reserveLines: [],
      simulationDate: '2026-09-10',
      theoreticalReserveCents: 45_000,
      upcomingPayments: [],
    });
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Recuperar sin aportarlo todo de golpe' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Si lo aportáis hoy' })).toBeInTheDocument();
    expect(screen.getByText('Aporte extraordinario hoy').parentElement).toHaveTextContent('150,00');
    expect(screen.getByText('Total a aportar este mes').parentElement).toHaveTextContent('1150,00');
    expect(screen.getByText('Saldo después del aporte').parentElement).toHaveTextContent('450,00');
    expect(screen.getByText(/no crea ni registra una aportación/i)).toBeInTheDocument();
  });

  it('activa el ajuste elegido directamente, incluida la opción de este mes', async () => {
    const user = userEvent.setup();
    mocks.simulation.mockResolvedValueOnce({
      deficitCents: 15_000,
      financialStatus: 'DEFICIT',
      monthlyStandardBudgetCents: 100_000,
      readiness: { ready: true },
      relevantAvailableBalanceCents: 30_000,
      reserveLines: [],
      simulationDate: '2026-09-10',
      theoreticalReserveCents: 45_000,
      upcomingPayments: [],
    });
    renderPage();

    await screen.findByRole('heading', { name: 'Aplicar un ajuste temporal' });
    await user.click(screen.getByRole('button', { name: 'Aplicar ajuste mensual' }));
    await waitFor(() =>
      expect(mocks.createRecovery).toHaveBeenLastCalledWith({
        householdId: 'household-1',
        body: expect.objectContaining({
          deficitCents: 15_000,
          mode: 'RECOMMENDED',
          startsOn: expect.any(String),
        }),
      }),
    );

    await user.click(screen.getByLabelText('Elegir mi importe mensual'));
    await user.type(screen.getByLabelText('Ajuste mensual (€)'), '80');
    await user.click(screen.getByRole('button', { name: 'Aplicar ajuste mensual' }));
    await waitFor(() =>
      expect(mocks.createRecovery).toHaveBeenLastCalledWith({
        householdId: 'household-1',
        body: expect.objectContaining({ maximumMonthlyCents: 8_000, mode: 'MAX_MONTHLY' }),
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Ajustar todo este mes' }));
    await waitFor(() =>
      expect(mocks.createRecovery).toHaveBeenLastCalledWith({
        householdId: 'household-1',
        body: expect.objectContaining({ mode: 'TARGET_MONTHS', targetMonths: 1 }),
      }),
    );
  });
});
