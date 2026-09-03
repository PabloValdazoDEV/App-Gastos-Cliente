import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listCategories: vi.fn(),
  listPeople: vi.fn(),
  deleteVariableMonth: vi.fn(),
  saveVariableMonth: vi.fn(),
  variableExpenses: vi.fn(),
  variableStatistics: vi.fn(),
}));

vi.mock('../features/finance/financeService', () => ({
  financeService: {
    deleteVariableMonth: mocks.deleteVariableMonth,
    saveVariableMonth: mocks.saveVariableMonth,
    variableExpenses: mocks.variableExpenses,
    variableStatistics: mocks.variableStatistics,
  },
}));

vi.mock('../features/households/householdService', () => ({
  householdService: {
    listCategories: mocks.listCategories,
    listPeople: mocks.listPeople,
  },
}));

vi.mock('../features/households/useHousehold', () => ({
  useHousehold: () => ({
    currentHousehold: { currency: 'EUR', id: 'household-1', name: 'Casa' },
    isError: false,
    isPending: false,
  }),
}));

import { VariableExpensesPage } from './VariableExpensesPage';

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <VariableExpensesPage />
    </QueryClientProvider>,
  );
}

describe('VariableExpensesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCategories.mockResolvedValue({
      categories: [{ id: 'category-1', name: 'Supermercado' }],
    });
    mocks.listPeople.mockResolvedValue({ people: [] });
    mocks.variableExpenses.mockResolvedValue([]);
    mocks.variableStatistics.mockResolvedValue([]);
    mocks.saveVariableMonth.mockResolvedValue({ id: 'month-created' });
    mocks.deleteVariableMonth.mockResolvedValue({ deleted: true, id: 'month-1' });
  });

  it('guarda SUMMARY sin enviar apuntes detallados', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', { name: 'No hay gastos variables' });
    await user.click(screen.getByRole('button', { name: 'Añadir el primer mes' }));
    expect(screen.queryByText('Ya están apuntados todos los gastos de este mes')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Total del mes (€)'), '325,40');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto variable' }));

    await waitFor(() => {
      expect(mocks.saveVariableMonth).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            entries: undefined,
            entryMode: 'SUMMARY',
            summaryAmountCents: 32_540,
          }),
        }),
      );
    });
    expect(mocks.saveVariableMonth.mock.calls[0][0].body).not.toHaveProperty('isComplete');
  });

  it('guarda un mes de gasto cero sin pedir confirmación adicional', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', { name: 'No hay gastos variables' });
    await user.click(screen.getByRole('button', { name: 'Añadir el primer mes' }));
    await user.type(screen.getByLabelText('Total del mes (€)'), '0');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto variable' }));

    await waitFor(() => {
      expect(mocks.saveVariableMonth).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            entryMode: 'SUMMARY',
            summaryAmountCents: 0,
          }),
        }),
      );
    });
  });

  it('guarda DETAIL sin enviar un total resumen', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', { name: 'No hay gastos variables' });
    await user.click(screen.getByRole('button', { name: 'Añadir el primer mes' }));
    await user.click(screen.getByLabelText('Apuntes detallados'));
    expect(screen.queryByLabelText('Fecha del apunte (opcional)')).not.toBeInTheDocument();
    expect(screen.getByText(/Por defecto:/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Importe (€)'), '24,90');
    await user.type(screen.getByLabelText('Comercio (opcional)'), 'Mercado');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto variable' }));

    await waitFor(() => {
      expect(mocks.saveVariableMonth).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            entries: [
              expect.objectContaining({
                amountCents: 2_490,
                merchant: 'Mercado',
                spentOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
              }),
            ],
            entryMode: 'DETAIL',
            summaryAmountCents: undefined,
          }),
        }),
      );
    });
  });

  it('edita un mes existente con sus datos precargados', async () => {
    const user = userEvent.setup();
    mocks.variableExpenses.mockResolvedValue([
      {
        category: { id: 'category-1', name: 'Supermercado' },
        categoryId: 'category-1',
        entryMode: 'SUMMARY',
        id: 'month-1',
        month: 8,
        notes: 'Compra habitual',
        personalPersonId: null,
        scope: 'HOUSEHOLD',
        summaryAmountCents: 30_000,
        year: 2026,
      },
    ]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Editar gasto de Supermercado de Agosto de 2026' }));
    expect(await screen.findByRole('heading', { name: 'Editar gasto variable' })).toBeInTheDocument();
    expect(screen.getByLabelText('Total del mes (€)')).toHaveValue('300.00');
    await user.clear(screen.getByLabelText('Total del mes (€)'));
    await user.type(screen.getByLabelText('Total del mes (€)'), '350,00');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(mocks.saveVariableMonth).toHaveBeenCalledWith({
        body: expect.objectContaining({
          categoryId: 'category-1',
          entryMode: 'SUMMARY',
          month: 8,
          summaryAmountCents: 35_000,
          year: 2026,
        }),
        householdId: 'household-1',
      });
    });
  });

  it('confirma antes de eliminar un mes variable', async () => {
    const user = userEvent.setup();
    mocks.variableExpenses.mockResolvedValue([
      {
        category: { id: 'category-1', name: 'Supermercado' },
        categoryId: 'category-1',
        entryMode: 'SUMMARY',
        id: 'month-1',
        month: 8,
        scope: 'HOUSEHOLD',
        summaryAmountCents: 30_000,
        year: 2026,
      },
    ]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Eliminar gasto de Supermercado de Agosto de 2026' }));
    expect(mocks.deleteVariableMonth).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('¿Eliminar este gasto variable?');
    await user.click(screen.getByRole('button', { name: 'Eliminar gasto' }));

    await waitFor(() => {
      expect(mocks.deleteVariableMonth).toHaveBeenCalledWith({
        householdId: 'household-1',
        variableMonthId: 'month-1',
      });
    });
  });

  it('muestra el selector de fecha únicamente al pedir cambiarla', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', { name: 'No hay gastos variables' });
    await user.click(screen.getByRole('button', { name: 'Añadir el primer mes' }));
    await user.click(screen.getByLabelText('Apuntes detallados'));

    const changeDateButton = screen.getByRole('button', { name: 'Cambiar fecha' });
    expect(changeDateButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(changeDateButton);

    expect(screen.getByLabelText('Fecha del apunte (opcional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ocultar fecha' })).toHaveAttribute('aria-expanded', 'true');
  });
});
