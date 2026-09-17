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
  setBudgetMarginPreference: vi.fn(),
}));

vi.mock('../features/finance/financeService', () => ({
  financeService: {
    deleteVariableMonth: mocks.deleteVariableMonth,
    saveVariableMonth: mocks.saveVariableMonth,
    variableExpenses: mocks.variableExpenses,
    variableStatistics: mocks.variableStatistics,
    setBudgetMarginPreference: mocks.setBudgetMarginPreference,
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
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const result = render(
    <QueryClientProvider client={client}>
      <VariableExpensesPage />
    </QueryClientProvider>,
  );
  return { ...result, client, invalidate };
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
    const { invalidate } = renderPage();

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
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'] }));
  });

  it('el margen pertenece al grupo recomendado, no al mes registrado', async () => {
    const user = userEvent.setup();
    const statistics = (enabled) => [{ categoryId: 'category-1', category: { name: 'Supermercado' }, ownerKey: 'HOUSEHOLD', scope: 'HOUSEHOLD', applySafetyMargin: enabled, effectiveMarginBps: enabled ? 1000 : 0, availableMarginBps: 1000, availableMarginSource: 'HOUSEHOLD', historicalAverageCents: 10_000, recommendedCents: enabled ? 11_000 : 10_000, averages: { months3: 10_000, months6: 10_000, months12: 10_000 }, completedMonths: 1 }];
    mocks.variableStatistics.mockResolvedValue(statistics(false));
    mocks.variableExpenses.mockResolvedValue([{ id: 'month-1', categoryId: 'category-1', category: { name: 'Supermercado' }, ownerKey: 'HOUSEHOLD', scope: 'HOUSEHOLD', year: 2026, month: 8, entryMode: 'SUMMARY', summaryAmountCents: 10_000, totalCents: 10_000 }]);
    mocks.setBudgetMarginPreference.mockImplementation(async ({ body }) => {
      mocks.variableStatistics.mockResolvedValue(statistics(body.applySafetyMargin));
      return statistics(body.applySafetyMargin)[0];
    });
    renderPage();
    const control = await screen.findByRole('checkbox', { name: /Aplicar margen al presupuesto recomendado/ });
    expect(control).not.toBeChecked();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    const recommended = screen.getByText('Presupuesto recomendado').parentElement;
    expect(recommended).toHaveTextContent('100,00');
    await user.click(control);
    await waitFor(() => expect(recommended).toHaveTextContent('110,00'));
    await user.click(control);
    await waitFor(() => expect(control).not.toBeChecked());
    expect(recommended).toHaveTextContent('100,00');
    expect(mocks.saveVariableMonth).not.toHaveBeenCalled();
    expect(mocks.variableExpenses).toHaveBeenCalledTimes(1);
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
    const { invalidate } = renderPage();

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
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'] }));
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
    const { invalidate } = renderPage();

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
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'] }));
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
    const { invalidate } = renderPage();

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
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'] }));
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
