import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  plannings: vi.fn(),
}));

vi.mock('../features/finance/financeService', () => ({
  financeService: {
    dashboard: mocks.dashboard,
    fundPlanning: vi.fn(),
    plannings: mocks.plannings,
    prepareMonth: vi.fn(),
    updateRecovery: vi.fn(),
  },
}));

vi.mock('../features/households/useHousehold', () => ({
  useHousehold: () => ({
    currentHousehold: { currency: 'EUR', id: 'household-1' },
    isPending: false,
  }),
}));

import { PlanningPage } from './PlanningPage';

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PlanningPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PlanningPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dashboard.mockResolvedValue({
      activeRecoveryPlan: { id: 'recovery-1', monthlyAdjustmentCents: 4_000 },
      balanceCents: 90_000,
      budget: {
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

    expect(screen.getByText('Total al preparar')).toBeInTheDocument();
    expect(screen.getByText(/^1040,00/)).toBeInTheDocument();
  });
});
