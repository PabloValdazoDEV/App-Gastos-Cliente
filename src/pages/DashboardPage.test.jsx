import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HouseholdContext } from '../features/households/householdStateContext';
import { financeService } from '../features/finance/financeService';
import { DashboardPage } from './DashboardPage';

vi.mock('../features/finance/financeService', () => ({
  financeService: {
    dashboard: vi.fn(),
    updateBalance: vi.fn(),
  },
}));

const household = {
  contributionDay: 10,
  currency: 'EUR',
  id: 'household-1',
  name: 'Casa',
};

function dashboardData(overrides = {}) {
  return {
    activeRecoveryPlan: null,
    balanceCents: 10_000,
    budget: {
      contributions: [
        {
          personId: 'person-1',
          personName: 'Pablo',
          personalExpenseCents: 0,
          standardHouseholdCents: 50_000,
          totalStandardCents: 50_000,
        },
      ],
      householdBudgetCents: 50_000,
      readiness: { ready: true },
      recommendedBudgetCents: 50_000,
      sourceCoverage: {
        invoiceCategoryCount: 0,
        recurringCount: 1,
        variableCategoryCount: 0,
      },
    },
    calculationDate: '2026-09-05',
    deficitCents: 40_000,
    financialStatus: 'DEFICIT',
    household: {
      currency: 'EUR',
      id: household.id,
      name: household.name,
      safetyMarginBps: 1000,
    },
    nextPayment: null,
    planning: null,
    theoreticalReserveCents: 50_000,
    ...overrides,
  };
}

function renderWithHousehold() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <HouseholdContext.Provider
        value={{
          currentHousehold: household,
          households: [household],
          isPending: false,
          isError: false,
        }}
      >
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </HouseholdContext.Provider>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explica el estado vacío sin inventar importes', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <HouseholdContext.Provider
          value={{
            currentHousehold: null,
            households: [],
            isPending: false,
            isError: false,
          }}
        >
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </HouseholdContext.Provider>
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole('heading', {
        name: '¿Cuánto necesitas aportar este mes?',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\d+[,.]\d{2}\s?€/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear mi hogar' })).toHaveAttribute(
      'href',
      '/hogar',
    );
  });

  it('mantiene el mes como pendiente antes del día habitual sin falsa alerta', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData());
    renderWithHousehold();

    expect(
      await screen.findByRole('heading', {
        name: 'Pendiente de aportación mensual',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/prevista para el día 10/i)).toBeInTheDocument();
    expect(screen.queryByText('Déficit detectado')).not.toBeInTheDocument();
    expect(screen.queryByText(/Faltan/)).not.toBeInTheDocument();
    expect(screen.queryByText('Reserva teórica')).not.toBeInTheDocument();

    const contribution = screen.getByRole('article', {
      name: 'Aportación de Pablo',
    });
    expect(within(contribution).getByText('Aportación conjunta')).toBeInTheDocument();
    expect(within(contribution).getByText('Gastos personales')).toBeInTheDocument();
    expect(within(contribution).getByText('Ajuste conjunto')).toBeInTheDocument();
    expect(within(contribution).getByText('Total a aportar')).toBeInTheDocument();
  });

  it('pide preparar el mes después del día habitual sin convertirlo en alarma', async () => {
    financeService.dashboard.mockResolvedValue(
      dashboardData({ calculationDate: '2026-09-12' }),
    );
    renderWithHousehold();

    expect(
      await screen.findByRole('heading', {
        name: 'Pendiente de preparar septiembre de 2026',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Confirma el saldo actual/i)).toBeInTheDocument();
    expect(screen.queryByText('Déficit detectado')).not.toBeInTheDocument();
  });

  it('ofrece registrar directamente el próximo vencimiento', async () => {
    financeService.dashboard.mockResolvedValue(
      dashboardData({
        nextPayment: {
          amountCents: 75_000,
          dueDate: '2026-09-15',
          expenseId: 'expense-rent',
          name: 'Alquiler',
        },
      }),
    );
    renderWithHousehold();

    const registerPayment = await screen.findByRole('link', {
      name: 'Registrar pago de Alquiler',
    });
    expect(registerPayment).toHaveAttribute(
      'href',
      '/gastos/recurrentes/expense-rent?action=register-payment',
    );
  });

  it('desglosa gastos comunes, personales, ajuste y total del mes preparado', async () => {
    financeService.dashboard.mockResolvedValue(
      dashboardData({
        calculationDate: '2026-09-12',
        planning: {
          contributions: [
            {
              householdPersonId: 'person-1',
              personName: 'Pablo',
              personalExpenseCents: 10_000,
              standardHouseholdCents: 40_000,
              temporaryAdjustmentCents: 2_000,
              totalRecommendedCents: 52_000,
            },
          ],
          fundingStatus: 'PREPARED',
          recommendedBudgetCents: 50_000,
        },
      }),
    );
    renderWithHousehold();

    const contribution = await screen.findByRole('article', {
      name: 'Aportación de Pablo',
    });
    expect(within(contribution).getByText(/400,00/)).toBeInTheDocument();
    expect(within(contribution).getByText(/100,00/)).toBeInTheDocument();
    expect(within(contribution).getByText(/^20,00/)).toBeInTheDocument();
    expect(within(contribution).getByText(/^520,00/)).toBeInTheDocument();
  });
});
