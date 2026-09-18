import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PurchaseLinkedExpenses } from './PurchaseLinkedExpenses';
import { linkedPurchaseExpenses } from './linkedPurchaseExpenses';

vi.mock('./purchasesService', () => ({ purchasesService: { detail: vi.fn(async () => financed) } }));
const upfront = { id: 'upfront', paymentMethod: 'UPFRONT', paymentDate: '2026-09-17', paidAmountCents: 9900, totalCents: 10000, ownershipType: 'HOUSEHOLD', items: [{ name: 'Microondas' }] };
const financed = { id: 'financed', paymentMethod: 'FINANCED', totalCents: 10000, purchaseDate: '2026-09-17', ownershipType: 'HOUSEHOLD', items: [{ name: 'Móvil' }], financing: {
  downPaymentCents: 1000, downPaymentPaidAt: '2026-09-17', installmentCount: 3, installmentAmountCents: 3334, financingTotalCents: 10000, firstInstallmentDate: '2027-01-31',
  progress: { pendingCents: 10000, totalCostCents: 11000, costOfFinancingCents: 1000, paidInstallmentCount: 0, installmentCount: 3, nextInstallment: { sequence: 1, expectedAmountCents: 3334, dueDate: '2027-01-31' } },
  installments: [{ id: 'installment', sequence: 1, dueDate: '2027-01-31', status: 'PLANNED', expectedAmountCents: 3334, canRegisterPayment: true }],
} };
function setup(kind, purchases = [upfront, financed]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><PurchaseLinkedExpenses householdId="home" currency="EUR" kind={kind} query={{ data: purchases }} /></MemoryRouter></QueryClientProvider>);
}
describe('automatic linked purchase expenses', () => {
  it('shows the single actual payment and financing entry in Puntuales, without installments', () => {
    setup('ONE_TIME');
    expect(screen.getByRole('heading', { name: 'Microondas' })).toBeVisible();
    expect(screen.getByText('99,00 €')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Móvil · Entrada' })).toBeVisible();
    expect(screen.getAllByText('Margen 0 %')).toHaveLength(2);
    expect(screen.queryByText('33,34 € / mes')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Gestionar pago' })[0]).toHaveAttribute('href', '/compras/upfront');
  });
  it('shows finite financing, exact last installment and manages canonical payments inline', async () => {
    const user = userEvent.setup(); setup('RECURRING');
    expect(screen.queryByRole('heading', { name: 'Microondas' })).not.toBeInTheDocument();
    expect(screen.getByText(/Última cuota: 33,32/)).toHaveTextContent('Total de cuotas: 100,00');
    expect(screen.getByText(/3 cuotas · Del/)).toHaveTextContent('31 mar 2027');
    expect(screen.getByText(/Coste total con entrada/)).toHaveTextContent('110,00');
    await user.click(screen.getByRole('button', { name: 'Ver y registrar cuotas' }));
    expect(await screen.findByRole('button', { name: 'Marcar cuota 1 como pagada' })).toBeVisible();
  });
  it('groups actual payments and down payments by payment date, keeping unpaid purchases visible', () => {
    setup('ONE_TIME', [
      { ...upfront, purchaseDate: '2025-12-30', paymentDate: '2026-01-01' },
      { ...financed, financing: { ...financed.financing, downPaymentPaidAt: '2025-12-31' } },
      { ...upfront, id: 'pending', paymentDate: null, items: [{ name: 'Sin pagar' }] },
    ]);
    const january = within(screen.getByRole('region', { name: '2026' })).getByRole('region', { name: 'Enero' });
    expect(within(january).getByRole('heading', { name: 'Microondas' })).toBeVisible();
    const december = within(screen.getByRole('region', { name: '2025' })).getByRole('region', { name: 'Diciembre' });
    expect(within(december).getByRole('heading', { name: 'Móvil · Entrada' })).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Sin fecha de pago' })).getByRole('heading', { name: 'Sin pagar' })).toBeVisible();
  });
  it('excludes archived purchases and nonexistent entries, and provides an independent search', async () => {
    expect(linkedPurchaseExpenses([{ ...upfront, archivedAt: '2026-09-17' }, { ...financed, financing: { ...financed.financing, downPaymentCents: 0 } }], 'ONE_TIME')).toEqual([]);
    const user = userEvent.setup(); setup('ONE_TIME');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar compras vinculadas' }), 'móvil');
    expect(screen.queryByRole('heading', { name: 'Microondas' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Móvil · Entrada' })).toBeVisible();
  });
});
