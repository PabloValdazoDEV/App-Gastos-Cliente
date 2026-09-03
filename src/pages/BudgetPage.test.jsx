import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ budget: vi.fn() }));

vi.mock('../features/finance/financeService', () => ({
  financeService: { budget: mocks.budget },
}));

vi.mock('../features/households/useHousehold', () => ({
  useHousehold: () => ({
    currentHousehold: { currency: 'EUR', id: 'household-1', name: 'Casa' },
    isPending: false,
  }),
}));

import { BudgetPage } from './BudgetPage';

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BudgetPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BudgetPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.budget.mockResolvedValue({
      contributions: [],
      householdBudgetCents: 100_000,
      lines: [
        {
          amountCents: 90_000,
          baseCents: 90_000,
          effectiveMarginBps: 0,
          id: 'rent',
          name: 'Alquiler',
          category: { color: '#4F6F62', icon: 'House', name: 'Vivienda' },
          scope: 'HOUSEHOLD',
          type: 'RECURRING',
        },
        {
          amountCents: 10_000,
          baseCents: 10_000,
          effectiveMarginBps: 0,
          id: 'electricity',
          name: 'Electricidad',
          category: { color: '#A56A25', icon: 'Zap', name: 'Luz' },
          scope: 'HOUSEHOLD',
          type: 'INVOICE',
        },
      ],
      personalBudgetCents: 0,
      readiness: { ready: true },
      recommendedBudgetCents: 100_000,
    });
  });

  it('muestra el nombre de cada partida en el desglose del cálculo', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Alquiler' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Electricidad' })).toBeInTheDocument();
    expect(screen.getAllByText('Gasto común')).toHaveLength(2);
    expect(document.querySelector('.lucide-house')).toBeInTheDocument();
    expect(document.querySelector('.lucide-zap')).toBeInTheDocument();
  });
});
