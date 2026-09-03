import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createRecurring: vi.fn(),
  deleteRecurring: vi.fn(),
  listCategories: vi.fn(),
  listPeople: vi.fn(),
  recurringPayments: vi.fn(),
  recurring: vi.fn(),
  reminderRules: vi.fn(),
  registerPayment: vi.fn(),
  updateRecurringPayment: vi.fn(),
  updateRecurring: vi.fn(),
  updateReminderRules: vi.fn(),
}));

vi.mock('../features/finance/financeService', () => ({
  financeService: {
    createRecurring: mocks.createRecurring,
    deleteRecurring: mocks.deleteRecurring,
    recurring: mocks.recurring,
    recurringPayments: mocks.recurringPayments,
    reminderRules: mocks.reminderRules,
    registerPayment: mocks.registerPayment,
    updateRecurringPayment: mocks.updateRecurringPayment,
    updateRecurring: mocks.updateRecurring,
    updateReminderRules: mocks.updateReminderRules,
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

import { RecurringExpensesPage } from './RecurringExpensesPage';

function renderPage(initialEntry = '/gastos/recurrentes') {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="gastos/recurrentes" element={<RecurringExpensesPage />} />
          <Route path="gastos/recurrentes/:expenseId" element={<RecurringExpensesPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('RecurringExpensesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCategories.mockResolvedValue({
      categories: [{ id: 'category-1', name: 'Vivienda' }],
    });
    mocks.listPeople.mockResolvedValue({ people: [] });
    mocks.createRecurring.mockResolvedValue({ id: 'expense-created' });
    mocks.deleteRecurring.mockResolvedValue({ id: 'expense-1', archivedAt: '2026-09-03T00:00:00.000Z' });
    mocks.recurringPayments.mockResolvedValue([]);
    mocks.reminderRules.mockResolvedValue([]);
    mocks.registerPayment.mockResolvedValue({ payment: { id: 'payment-1' } });
    mocks.updateRecurringPayment.mockResolvedValue({ id: 'payment-1' });
    mocks.updateRecurring.mockResolvedValue({ id: 'expense-1' });
    mocks.updateReminderRules.mockImplementation(({ rules }) => Promise.resolve(rules));
  });

  it('muestra todos los gastos recurrentes, aunque su vencimiento sea lejano', async () => {
    mocks.recurring.mockResolvedValue([
      {
        amountCents: 12_000,
        category: { name: 'Seguros' },
        frequency: 'YEARLY',
        id: 'expense-future',
        name: 'Seguro anual',
        nextDueDate: '2027-12-31T00:00:00.000Z',
        remindersEnabled: true,
        scope: 'HOUSEHOLD',
      },
    ]);
    renderPage();

    expect(await screen.findByText('Seguro anual')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Todos los gastos recurrentes' })).toBeInTheDocument();
  });

  it('crea un gasto recurrente desde un formulario con labels persistentes', async () => {
    const user = userEvent.setup();
    mocks.recurring.mockResolvedValue([]);
    renderPage();

    await screen.findByRole('heading', { name: 'No hay gastos recurrentes' });
    await user.click(screen.getByRole('button', { name: 'Añadir el primer gasto' }));
    expect(screen.getByText('El día en que empezó este gasto. Por ejemplo, cuando comenzó tu contrato de alquiler.')).toBeInTheDocument();
    expect(screen.getByText('La fecha del siguiente pago que tienes que hacer.')).toBeInTheDocument();
    expect(screen.getByText('La fecha del último pago. Si el gasto seguirá activo, déjala vacía.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nombre del gasto'), 'Alquiler');
    await user.type(screen.getByLabelText('Importe previsto (€)'), '850,25');
    await user.click(screen.getByRole('radio', { name: /Margen propio/i }));
    await user.type(screen.getByLabelText('Margen específico (%)'), '12,5');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto recurrente' }));

    expect(mocks.createRecurring).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: 'household-1',
        body: expect.objectContaining({
          amountCents: 85_025,
          categoryId: 'category-1',
          frequency: 'MONTHLY',
          name: 'Alquiler',
          safetyMarginOverrideBps: 1_250,
          scope: 'HOUSEHOLD',
        }),
      }),
    );
  });

  it('registra por separado el importe previsto y el realmente pagado', async () => {
    const user = userEvent.setup();
    mocks.recurring.mockResolvedValue([
      {
        amountCents: 5_000,
        category: { name: 'Servicios' },
        frequency: 'MONTHLY',
        id: 'expense-1',
        name: 'Internet',
        nextDueDate: '2026-08-30T00:00:00.000Z',
        scope: 'HOUSEHOLD',
      },
    ]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Registrar pago' }));
    const amount = screen.getByLabelText('Importe real (€)');
    await user.clear(amount);
    await user.type(amount, '49,50');
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));

    expect(mocks.registerPayment).toHaveBeenCalledWith({
      body: expect.objectContaining({
        actualAmountCents: 4_950,
        expectedAmountCents: 5_000,
        status: 'PAID',
      }),
      expenseId: 'expense-1',
      householdId: 'household-1',
    });
  });

  it('confirma antes de eliminar un gasto recurrente', async () => {
    const user = userEvent.setup();
    mocks.recurring.mockResolvedValue([
      {
        amountCents: 5_000,
        category: { name: 'Servicios' },
        frequency: 'MONTHLY',
        id: 'expense-1',
        name: 'Internet',
        nextDueDate: '2026-08-30T00:00:00.000Z',
        scope: 'HOUSEHOLD',
      },
    ]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Eliminar Internet' }));
    expect(mocks.deleteRecurring).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('¿Eliminar Internet?');
    await user.click(screen.getByRole('button', { name: 'Eliminar gasto' }));

    await waitFor(() => {
      expect(mocks.deleteRecurring).toHaveBeenCalledWith({
        expenseId: 'expense-1',
        householdId: 'household-1',
      });
    });
  });

  it('abre directamente el formulario de pago desde el enlace del inicio', async () => {
    mocks.recurring.mockResolvedValue([
      {
        amountCents: 5_000,
        category: { name: 'Servicios' },
        frequency: 'MONTHLY',
        id: 'expense-1',
        name: 'Internet',
        nextDueDate: '2026-08-30T00:00:00.000Z',
        scope: 'HOUSEHOLD',
      },
    ]);
    renderPage('/gastos/recurrentes/expense-1?action=register-payment');

    expect(await screen.findByRole('form', { name: 'Registrar pago de Internet' })).toBeInTheDocument();
    expect(screen.getByLabelText('Importe real (€)')).toHaveValue('50.00');
  });

  it('actualiza el próximo importe solo cuando se elige esa decisión', async () => {
    const user = userEvent.setup();
    mocks.recurring.mockResolvedValue([
      {
        amountCents: 5_000,
        category: { name: 'Servicios' },
        frequency: 'MONTHLY',
        id: 'expense-1',
        name: 'Internet',
        nextDueDate: '2026-08-30T00:00:00.000Z',
        scope: 'HOUSEHOLD',
      },
    ]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Registrar pago' }));
    const amount = screen.getByLabelText('Importe real (€)');
    await user.clear(amount);
    await user.type(amount, '49,50');
    await user.click(
      screen.getByRole('checkbox', {
        name: /Usar el importe real en el próximo vencimiento/i,
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));

    expect(mocks.registerPayment).toHaveBeenCalledWith({
      body: expect.objectContaining({
        actualAmountCents: 4_950,
        nextAmountDecision: 'UPDATE_NEXT_AMOUNT',
        nextExpectedAmountCents: 4_950,
        status: 'PAID',
      }),
      expenseId: 'expense-1',
      householdId: 'household-1',
    });
  });

  it('descarta la actualización del importe al cambiar el vencimiento a omitido', async () => {
    const user = userEvent.setup();
    mocks.recurring.mockResolvedValue([
      {
        amountCents: 5_000,
        category: { name: 'Servicios' },
        frequency: 'MONTHLY',
        id: 'expense-1',
        name: 'Internet',
        nextDueDate: '2026-08-30T00:00:00.000Z',
        scope: 'HOUSEHOLD',
      },
    ]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Registrar pago' }));
    await user.click(
      screen.getByRole('checkbox', {
        name: /Usar el importe real en el próximo vencimiento/i,
      }),
    );
    await user.click(screen.getByRole('radio', { name: 'Omitido' }));
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));

    expect(mocks.registerPayment).toHaveBeenCalledWith({
      body: expect.objectContaining({
        actualAmountCents: null,
        nextAmountDecision: 'KEEP_PREVIOUS',
        nextExpectedAmountCents: null,
        status: 'SKIPPED',
      }),
      expenseId: 'expense-1',
      householdId: 'household-1',
    });
  });

  it('edita el margen específico sin alterar el histórico', async () => {
    const user = userEvent.setup();
    mocks.recurring.mockResolvedValue([
      {
        amountCents: 5_000,
        category: { id: 'category-1', name: 'Servicios' },
        categoryId: 'category-1',
        endDate: null,
        frequency: 'MONTHLY',
        id: 'expense-1',
        intervalMonths: null,
        name: 'Internet',
        nextDueDate: '2026-08-30T00:00:00.000Z',
        notes: null,
        personalPersonId: null,
        remindersEnabled: true,
        safetyMarginOverrideBps: null,
        scope: 'HOUSEHOLD',
        startDate: '2026-01-30T00:00:00.000Z',
      },
    ]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.click(screen.getByRole('radio', { name: /Margen propio/i }));
    await user.type(screen.getByLabelText('Margen específico (%)'), '8,75');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(mocks.updateRecurring).toHaveBeenCalledWith({
      householdId: 'household-1',
      expenseId: 'expense-1',
      body: expect.objectContaining({
        amountCents: 5_000,
        name: 'Internet',
        safetyMarginOverrideBps: 875,
      }),
    });
  });

  it('muestra el histórico y guarda reglas personales de aviso', async () => {
    const user = userEvent.setup();
    mocks.recurring.mockResolvedValue([
      {
        amountCents: 5_000,
        category: { name: 'Servicios' },
        frequency: 'MONTHLY',
        id: 'expense-1',
        name: 'Internet',
        nextDueDate: '2026-08-30T00:00:00.000Z',
        remindersEnabled: true,
        scope: 'HOUSEHOLD',
      },
    ]);
    mocks.recurringPayments.mockResolvedValue([
      {
        actualAmountCents: 4_950,
        dueDate: '2026-07-30T00:00:00.000Z',
        expectedAmountCents: 5_000,
        id: 'payment-1',
        paymentDate: '2026-07-29T00:00:00.000Z',
        status: 'PAID',
      },
    ]);
    mocks.reminderRules.mockResolvedValue([
      { channel: 'IN_APP', enabled: true, id: 'rule-1', offsetDays: 7 },
    ]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Ver detalles' }));
    expect(await screen.findByText('Vencimiento 30 jul 2026')).toBeInTheDocument();
    expect(screen.getByText(/49,50/)).toBeInTheDocument();
    const offset = await screen.findByLabelText('Días de antelación');
    await user.clear(offset);
    await user.type(offset, '14');
    await user.click(screen.getByRole('button', { name: 'Guardar reglas' }));

    expect(mocks.updateReminderRules).toHaveBeenCalledWith({
      householdId: 'household-1',
      expenseId: 'expense-1',
      rules: [{ channel: 'IN_APP', enabled: true, offsetDays: 14 }],
    });
  });

  it('permite corregir un pago registrado sin tocar el gasto recurrente', async () => {
    const user = userEvent.setup();
    mocks.recurring.mockResolvedValue([
      {
        amountCents: 5_000,
        category: { name: 'Servicios' },
        frequency: 'MONTHLY',
        id: 'expense-1',
        name: 'Internet',
        nextDueDate: '2026-08-30T00:00:00.000Z',
        remindersEnabled: true,
        scope: 'HOUSEHOLD',
      },
    ]);
    mocks.recurringPayments.mockResolvedValue([
      {
        actualAmountCents: 4_950,
        dueDate: '2026-07-30T00:00:00.000Z',
        expectedAmountCents: 5_000,
        id: 'payment-1',
        notes: 'Cobro inicial',
        paymentDate: '2026-07-29T00:00:00.000Z',
        status: 'PAID',
      },
    ]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Ver detalles' }));
    await user.click(await screen.findByRole('button', { name: 'Editar pago' }));
    const amount = screen.getByLabelText('Importe real (€)');
    await user.clear(amount);
    await user.type(amount, '51,20');
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }));

    expect(mocks.updateRecurringPayment).toHaveBeenCalledWith({
      householdId: 'household-1',
      expenseId: 'expense-1',
      paymentId: 'payment-1',
      body: {
        actualAmountCents: 5_120,
        notes: 'Cobro inicial',
        paymentDate: '2026-07-29',
        status: 'PAID',
      },
    });
    expect(mocks.updateRecurring).not.toHaveBeenCalled();
  });

  it('expande y resalta el gasto enlazado sin abrir el formulario de pago', async () => {
    mocks.recurring.mockResolvedValue([
      {
        amountCents: 5_000,
        category: { name: 'Servicios' },
        frequency: 'MONTHLY',
        id: 'expense-1',
        name: 'Internet',
        nextDueDate: '2026-08-30T00:00:00.000Z',
        remindersEnabled: true,
        scope: 'HOUSEHOLD',
      },
    ]);
    renderPage('/gastos/recurrentes/expense-1');

    expect(await screen.findByText('Gasto relacionado con el aviso')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Histórico de vencimientos' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Registrar vencimiento' })).not.toBeInTheDocument();
  });

  it('avisa cuando el gasto enlazado ya no existe', async () => {
    mocks.recurring.mockResolvedValue([]);
    renderPage('/gastos/recurrentes/expense-missing');

    expect(await screen.findByText('No se encuentra el gasto enlazado')).toBeInTheDocument();
  });
});
