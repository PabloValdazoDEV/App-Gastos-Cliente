import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ registerPayment: vi.fn() }));
vi.mock('../financeService', () => ({ financeService: { registerPayment: mocks.registerPayment } }));

import { dueLabel } from '../homeSummary';
import { ContributionCard, DuePaymentsCard } from './HomeSummary';

const household = { currency: 'EUR' };

function renderWithClient(ui) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

describe('Inicio: tu aportación', () => {
  it('muestra la aportación preparada y lo que queda por ingresar', () => {
    renderWithClient(<ContributionCard
      data={{ household, planning: { contributions: [
        { canConfirmPersonal: false, totalRecommendedCents: 50_000, totalPendingCents: 50_000 },
        { canConfirmPersonal: true, totalRecommendedCents: 82_000, totalPendingCents: 30_000, extraFunding: { agreedCents: 0 } },
      ] } }}
      month="2026-11"
      monthLabel="noviembre de 2026"
    />);
    expect(screen.getByRole('heading', { name: 'Tu aportación de noviembre de 2026' })).toBeInTheDocument();
    expect(screen.getByText('820,00 €')).toBeInTheDocument();
    expect(screen.getByText('Te queda por ingresar 300,00 €.')).toBeInTheDocument();
  });

  it('sin preparar el mes muestra la estimación de la persona que mira', () => {
    renderWithClient(<ContributionCard
      data={{ household, planning: null, viewerPersonId: 'p2', budget: { readiness: { ready: true }, contributions: [
        { personId: 'p1', totalStandardCents: 50_000 },
        { personId: 'p2', totalStandardCents: 61_050 },
      ] } }}
      month="2026-11"
      monthLabel="noviembre de 2026"
    />);
    expect(screen.getByText('610,50 €')).toBeInTheDocument();
    expect(screen.getByText(/Estimación con los gastos de hoy/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Preparar el mes' })).toHaveAttribute('href', '/planificacion?mes=2026-11');
  });
});

describe('Inicio: pagos de hoy y atrasados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.registerPayment.mockResolvedValue({ payment: { id: 'payment-1' } });
  });

  const data = {
    household,
    calculationDate: '2026-11-06',
    upcomingPayments: [
      { sourceType: 'RECURRING_EXPENSE', expenseId: 'kia', name: 'Seguro Kia', dueDate: '2026-11-02', amountCents: 41_000 },
      { sourceType: 'PURCHASE_INSTALLMENT', purchaseId: 'tv', name: 'Televisor · Cuota 2/10', dueDate: '2026-11-06', amountCents: 9_900 },
      { sourceType: 'RECURRING_EXPENSE', expenseId: 'gym', name: 'Gym', dueDate: '2026-11-09', amountCents: 3_500 },
    ],
  };

  it('marca un atrasado como pagado con un solo toque, con el importe previsto y fecha de hoy', async () => {
    const user = userEvent.setup();
    renderWithClient(<DuePaymentsCard data={data} householdId="household-1" />);

    expect(screen.getByText(/Venció hace 4 días/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Marcar Seguro Kia como pagado hoy por 410,00/ }));

    await waitFor(() => expect(mocks.registerPayment).toHaveBeenCalledWith({
      householdId: 'household-1',
      expenseId: 'kia',
      body: expect.objectContaining({
        status: 'PAID', actualAmountCents: 41_000, paymentDate: '2026-11-06', dueDate: '2026-11-02',
        nextAmountDecision: 'KEEP_PREVIOUS',
      }),
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Pagado');
  });

  it('las cuotas de compras llevan a su detalle y los próximos días solo se listan', () => {
    renderWithClient(<DuePaymentsCard data={data} householdId="household-1" />);
    expect(screen.getByRole('link', { name: 'Ver cuota' })).toHaveAttribute('href', '/compras/tv');
    expect(screen.queryByRole('button', { name: /Gym/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Gym \(vence en 3 días\)/)).toBeInTheDocument();
  });

  it('dice claramente cuando no hay nada pendiente', () => {
    renderWithClient(<DuePaymentsCard data={{ household, calculationDate: '2026-11-06', upcomingPayments: [] }} householdId="h" />);
    expect(screen.getByText('No tienes nada pendiente para hoy.')).toBeInTheDocument();
  });

  it('etiquetas de vencimiento legibles', () => {
    expect(dueLabel('2026-11-06', '2026-11-06')).toBe('Vence hoy');
    expect(dueLabel('2026-11-07', '2026-11-06')).toBe('Vence mañana');
    expect(dueLabel('2026-11-05', '2026-11-06')).toBe('Venció ayer');
  });
});
