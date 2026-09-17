import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ budget: vi.fn(), listCategories: vi.fn() }));

vi.mock('../features/finance/financeService', () => ({
  financeService: { budget: mocks.budget },
}));

vi.mock('../features/households/householdService', () => ({
  householdService: { listCategories: mocks.listCategories },
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
    mocks.listCategories.mockResolvedValue({ categories: [{ id: 'light', name: 'Luz' }] });
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
          category: { id: 'light', color: '#A56A25', icon: 'Zap', name: 'Luz' },
          scope: 'HOUSEHOLD',
          type: 'INVOICE',
        },
        {
          amountCents: 3_000, baseCents: 3_000, effectiveMarginBps: 0,
          id: 'groceries', name: 'Compra mensual', scope: 'PERSONAL', type: 'VARIABLE',
        },
        {
          amountCents: 2_000, baseCents: 2_000, effectiveMarginBps: 0,
          id: 'repair', name: 'Reparación', scope: 'PERSONAL', type: 'ONE_TIME',
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
    expect(screen.getByText(/Sin margen · Base 100,00/)).toBeInTheDocument();
    expect(screen.queryByText(/margen 0 %/)).not.toBeInTheDocument();
  });

  it('explica base, porcentaje e importe de margen sin restar protagonismo al total', async () => {
    mocks.budget.mockResolvedValue({ readiness: { ready: true }, contributions: [], lines: [{ id: 'light', name: 'Luz', type: 'INVOICE', scope: 'HOUSEHOLD', amountCents: 11_000, baseCents: 10_000, effectiveMarginBps: 1000 }] });
    renderPage();
    expect(await screen.findByText(/Base 100,00.*\+ 10 % de margen \(10,00/)).toBeInTheDocument();
    expect(screen.getByText(/110,00/)).toBeInTheDocument();
  });

  it('filtra los cuatro tipos solo en el desglose y permite volver a Todos', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Alquiler' });
    expect(screen.queryByRole('combobox', { name: 'Tipo de gasto' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const select = screen.getByRole('combobox', { name: 'Tipo de gasto' });
    const types = { RECURRING: 'Alquiler', INVOICE: 'Electricidad', VARIABLE: 'Compra mensual', ONE_TIME: 'Reparación' };
    for (const [type, name] of Object.entries(types)) {
      await user.selectOptions(select, type);
      for (const lineName of Object.values(types)) {
        expect(Boolean(screen.queryByRole('heading', { name: lineName }))).toBe(lineName === name);
      }
      expect(screen.getByRole('button', { name: 'Filtros 1 activo' })).toBeInTheDocument();
    }
    await user.selectOptions(select, 'ALL');
    Object.values(types).forEach((name) => expect(screen.getByRole('heading', { name })).toBeInTheDocument());
    expect(screen.getByText('Total recomendado').parentElement).toHaveTextContent('1000,00');
    expect(mocks.budget).toHaveBeenCalledTimes(1);
  });

  it('combina tipo, ámbito, categoría y búsqueda y distingue el vacío filtrado', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Filtros' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo de gasto' }), 'INVOICE');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ámbito' }), 'HOUSEHOLD');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Categoría' }), 'light');
    await user.type(screen.getByRole('searchbox'), 'Electricidad');
    expect(screen.getByRole('heading', { name: 'Electricidad' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtros 3 activos' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ámbito' }), 'PERSONAL');
    expect(screen.getByRole('status')).toHaveTextContent('No hay partidas que coincidan con los filtros');
    expect(screen.queryByText('No hay partidas todavía')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByRole('heading', { name: 'Alquiler' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('añade Compras al filtro sin cambiar los totales ni tratar sus pagos como puntuales', async () => {
    const user = userEvent.setup();
    mocks.budget.mockResolvedValue({ readiness: { ready: true }, contributions: [], householdBudgetCents: 95000, personalBudgetCents: 0, recommendedBudgetCents: 95000, lines: [
      { id: 'upfront', type: 'PURCHASE', sourceType: 'PURCHASE_UPFRONT', purchaseId: 'phone', name: 'Móvil · Al contado', scope: 'HOUSEHOLD', amountCents: 90000, baseCents: 90000, canAccessPurchase: true },
      { id: 'installment', type: 'PURCHASE', sourceType: 'PURCHASE_INSTALLMENT', purchaseId: 'tv', name: 'Televisor · Cuota 3/20', scope: 'HOUSEHOLD', amountCents: 5000, baseCents: 5000, canAccessPurchase: true },
      { id: 'rent', type: 'RECURRING', name: 'Alquiler', scope: 'HOUSEHOLD', amountCents: 70000, baseCents: 70000 },
    ] });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Filtros' }));
    const type = screen.getByRole('combobox', { name: 'Tipo de gasto' });
    expect(within(type).getByRole('option', { name: 'Compras' })).toHaveValue('PURCHASE');
    await user.selectOptions(type, 'PURCHASE');
    expect(screen.getByRole('heading', { name: 'Móvil · Al contado' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Televisor · Cuota 3/20' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Alquiler' })).not.toBeInTheDocument();
    expect(screen.getByText('Total recomendado').parentElement).toHaveTextContent('950,00');
    expect(screen.getByRole('link', { name: 'Ver compra: Móvil · Al contado' })).toHaveAttribute('href', '/compras/phone');
    expect(screen.getByText(/Compra al contado · obligación del mes/)).toBeInTheDocument();
    expect(screen.getByText(/Cuota de compra · obligación del mes/)).toBeInTheDocument();
    await user.selectOptions(type, 'ONE_TIME');
    expect(screen.queryByRole('heading', { name: 'Móvil · Al contado' })).not.toBeInTheDocument();
    expect(mocks.budget).toHaveBeenCalledTimes(1);
  });

  it('muestra entradas y solo la parte personal asignada a un participante SPLIT', async () => {
    mocks.budget.mockResolvedValue({ readiness: { ready: true }, contributions: [], lines: [
      { id: 'entry', type: 'PURCHASE', sourceType: 'PURCHASE_DOWN_PAYMENT', purchaseId: 'purchase', name: 'Móvil · Entrada', scope: 'PERSONAL', ownershipType: 'SPLIT', shareBps: 6000, personalPersonId: 'viewer', amountCents: 12000, baseCents: 12000, canAccessPurchase: true },
      { id: 'installment', type: 'PURCHASE', sourceType: 'PURCHASE_INSTALLMENT', purchaseId: 'purchase', name: 'Móvil · Cuota 1/20', scope: 'PERSONAL', ownershipType: 'SPLIT', shareBps: 6000, personalPersonId: 'viewer', amountCents: 6000, baseCents: 6000, canAccessPurchase: true },
    ] });
    renderPage();
    const heading = await screen.findByRole('heading', { name: 'Móvil · Cuota 1/20' });
    const card = heading.closest('li');
    expect(card).toHaveTextContent('Tu parte de una compra repartida (60 %)');
    expect(card).toHaveTextContent('60,00');
    expect(card).not.toHaveTextContent('100,00');
    expect(card).not.toHaveTextContent('40,00');
    expect(screen.getByText(/Entrada de compra · obligación del mes/)).toBeInTheDocument();
  });

  it('no enlaza una compra histórica que ya no es accesible', async () => {
    mocks.budget.mockResolvedValue({ readiness: { ready: true }, contributions: [], lines: [
      { id: 'historical', type: 'PURCHASE', sourceType: 'PURCHASE_UPFRONT', purchaseId: 'hidden', name: 'Compra personal (histórico)', scope: 'PERSONAL', amountCents: 6000, baseCents: 6000, canAccessPurchase: false },
    ] });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Compra personal (histórico)' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ver compra/ })).not.toBeInTheDocument();
  });

  it('combina Compras, ámbito y búsqueda con nombres largos y enlaces táctiles', async () => {
    const user = userEvent.setup();
    const name = `${'Producto'.repeat(25)} · Cuota 1/20`;
    mocks.budget.mockResolvedValue({ readiness: { ready: true }, contributions: [], lines: [
      { id: 'personal', type: 'PURCHASE', sourceType: 'PURCHASE_INSTALLMENT', purchaseId: 'p', name, scope: 'PERSONAL', amountCents: 6000, baseCents: 6000, canAccessPurchase: true },
      { id: 'common', type: 'PURCHASE', sourceType: 'PURCHASE_INSTALLMENT', purchaseId: 'c', name: 'Televisor', scope: 'HOUSEHOLD', amountCents: 4000, baseCents: 4000, canAccessPurchase: true },
    ] });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Filtros' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo de gasto' }), 'PURCHASE');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ámbito' }), 'PERSONAL');
    await user.type(screen.getByRole('searchbox'), 'Producto');
    expect(screen.getByRole('heading', { name }).closest('li')).toHaveClass('min-w-0', '[overflow-wrap:anywhere]');
    expect(screen.getByRole('link', { name: `Ver compra: ${name}` })).toHaveClass('min-h-11', 'max-w-full');
    expect(screen.queryByRole('heading', { name: 'Televisor' })).not.toBeInTheDocument();
  });

  it('permite ajustar totales grandes y nombres largos sin anchos mínimos desbordados', async () => {
    const personName = 'NombreSinEspacios'.repeat(15);
    mocks.budget.mockResolvedValue({
      readiness: { ready: true }, lines: [], householdBudgetCents: 2147483647,
      personalBudgetCents: 2147483647, recommendedBudgetCents: 4294967294,
      contributions: [{ personId: 'person', personName, contributionBps: 10000, totalStandardCents: 4294967294, personalExpenseCents: 2147483647 }],
    });
    renderPage();
    const totals = await screen.findByRole('region', { name: 'Totales del presupuesto' });
    for (const article of within(totals).getAllByRole('article')) {
      expect(article).toHaveClass('min-w-0', '[overflow-wrap:anywhere]');
    }
    const heading = screen.getByRole('heading', { name: personName });
    expect(heading.closest('article')).toHaveClass('min-w-0', '[overflow-wrap:anywhere]');
    expect(heading.parentElement).toHaveClass('min-w-0', 'flex-1');
    expect(heading.parentElement.parentElement).toHaveClass('flex-wrap');
  });
});
