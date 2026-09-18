import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
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

vi.mock('../features/purchases/purchasesService', () => ({ purchasesService: { list: vi.fn(async () => []) } }));

function renderPage(initialEntry = '/gastos/recurrentes') {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const view = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="gastos/recurrentes" element={<RecurringExpensesPage />} />
          <Route path="gastos/recurrentes/:expenseId" element={<RecurringExpensesPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...view, client };
}

function recurringExpense(overrides = {}) {
  return {
    amountCents: 4_000,
    category: { id: 'category-1', name: 'Vivienda' },
    categoryId: 'category-1',
    endDate: null,
    frequency: 'CUSTOM_WEEKS',
    id: 'expense-1',
    intervalMonths: null,
    intervalWeeks: 4,
    name: 'Gimnasio',
    nextDueDate: '2026-09-17T00:00:00.000Z',
    notes: null,
    personalPersonId: null,
    remindersEnabled: true,
    safetyMarginOverrideBps: null,
    scope: 'HOUSEHOLD',
    startDate: '2026-09-17T00:00:00.000Z',
    ...overrides,
  };
}

async function openCreateForm(user) {
  mocks.recurring.mockResolvedValue([]);
  const view = renderPage();
  await user.click(await screen.findByRole('button', { name: 'Añadir el primer gasto' }));
  await user.type(screen.getByLabelText('Nombre del gasto'), 'Gimnasio');
  await user.type(screen.getByLabelText('Importe previsto (€)'), '40');
  return view;
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
    for (const label of ['Fecha de inicio', 'Próximo vencimiento', 'Fecha final (opcional)']) {
      const date = screen.getByLabelText(label);
      expect(date).toHaveClass('min-w-0', 'max-w-full');
      expect(date.parentElement).toHaveClass('min-w-0');
      expect(date.parentElement.parentElement).toHaveClass('date-fields-grid');
    }
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

  it('restaura el foco al cancelar el formulario de pago compartido', async () => {
    const user = userEvent.setup();
    mocks.recurring.mockResolvedValue([recurringExpense()]);
    renderPage();
    const trigger = await screen.findByRole('button', { name: 'Registrar pago' });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('radio', { name: 'Pagado' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancelar', exact: true }));
    expect(screen.queryByRole('form', { name: /Registrar pago de/ })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    expect(mocks.registerPayment).not.toHaveBeenCalled();
  });

  it('cierra la corrección histórica al abrir un nuevo registro y mantiene un único formulario de pago', async () => {
    const user = userEvent.setup();
    mocks.recurring.mockResolvedValue([recurringExpense()]);
    mocks.recurringPayments.mockResolvedValue([{
      id: 'payment-1', status: 'PAID', dueDate: '2026-08-20', expectedAmountCents: 4_000,
      actualAmountCents: 4_000, paymentDate: '2026-08-20', notes: null,
    }]);
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Ver detalles' }));
    const edit = await screen.findByRole('button', { name: 'Editar pago' });
    await user.click(edit);
    expect(edit).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('form', { name: /Editar pago de/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Cancelar', exact: true }));
    expect(edit).toHaveFocus();
    await user.click(edit);
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(screen.queryByRole('form', { name: /Editar pago de/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('form', { name: /Registrar pago de/ })).toHaveLength(1);
  });

  it('una respuesta tardía de registro no cierra ni roba el foco al formulario de otro gasto', async () => {
    const user = userEvent.setup();
    let resolveSave;
    mocks.registerPayment.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    mocks.recurring.mockResolvedValue([recurringExpense(), recurringExpense({ id: 'expense-2', name: 'Alquiler' })]);
    renderPage();
    const triggers = await screen.findAllByRole('button', { name: 'Registrar pago' });
    await user.click(triggers[0]);
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));
    await waitFor(() => expect(mocks.registerPayment).toHaveBeenCalledOnce());
    await user.click(triggers[1]);
    const notes = screen.getByLabelText('Notas (opcional)');
    await user.type(notes, 'Borrador activo');
    await act(async () => { resolveSave({ payment: { id: 'payment-created' } }); });
    expect(screen.getByRole('form', { name: 'Registrar pago de Alquiler' })).toBeInTheDocument();
    expect(notes).toHaveFocus();
    expect(notes).toHaveValue('Borrador activo');
  });

  it('una respuesta tardía de corrección no cierra ni roba el foco al otro registro histórico', async () => {
    const user = userEvent.setup();
    let resolveSave;
    mocks.updateRecurringPayment.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    mocks.recurring.mockResolvedValue([recurringExpense()]);
    mocks.recurringPayments.mockResolvedValue([
      { id: 'payment-1', status: 'PAID', dueDate: '2026-08-20', expectedAmountCents: 4_000, actualAmountCents: 4_000, paymentDate: '2026-08-20', notes: null },
      { id: 'payment-2', status: 'PAID', dueDate: '2026-07-23', expectedAmountCents: 4_000, actualAmountCents: 4_000, paymentDate: '2026-07-23', notes: null },
    ]);
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Ver detalles' }));
    const triggers = await screen.findAllByRole('button', { name: 'Editar pago' });
    await user.click(triggers[0]);
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }));
    await waitFor(() => expect(mocks.updateRecurringPayment).toHaveBeenCalledOnce());
    await user.click(triggers[1]);
    const notes = screen.getByLabelText('Notas (opcional)');
    await user.type(notes, 'Otra corrección');
    await act(async () => { resolveSave({ id: 'payment-1' }); });
    expect(screen.getByRole('form', { name: /Editar pago de 23/ })).toBeInTheDocument();
    expect(triggers[1]).toHaveAttribute('aria-expanded', 'true');
    expect(notes).toHaveFocus();
    expect(notes).toHaveValue('Otra corrección');
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
    expect(mocks.registerPayment).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar omisión' }));

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

  it('mantiene Mensual por defecto y ofrece semanas sin mostrar intervalos innecesarios', async () => {
    const user = userEvent.setup();
    await openCreateForm(user);

    expect(screen.getByLabelText('Periodicidad')).toHaveValue('MONTHLY');
    expect(screen.getByRole('option', { name: 'Cada varias semanas' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Semanal' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Se repite cada (semanas)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Se repite cada (meses)')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar gasto recurrente' }));

    expect(mocks.createRecurring).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ frequency: 'MONTHLY', intervalMonths: null, intervalWeeks: null }),
    }));
  });

  it.each([2, 3, 4, 5, 520])('crea cada %i semanas y explica los días reales antes de guardar', async (weeks) => {
    const user = userEvent.setup();
    await openCreateForm(user);
    await user.selectOptions(screen.getByLabelText('Periodicidad'), 'CUSTOM_WEEKS');
    const input = screen.getByRole('spinbutton', { name: 'Se repite cada (semanas)' });
    expect(input).toHaveValue(4);
    await user.clear(input);
    await user.type(input, String(weeks));

    expect(input).toHaveAccessibleDescription(
      `Cada ${weeks} semanas significa cada ${weeks * 7} días. No es lo mismo que un cobro mensual: la fecha puede cambiar de un mes a otro.`,
    );
    await user.click(screen.getByRole('button', { name: 'Guardar gasto recurrente' }));
    expect(mocks.createRecurring).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        amountCents: 4_000,
        frequency: 'CUSTOM_WEEKS',
        intervalWeeks: weeks,
        intervalMonths: null,
        safetyMarginOverrideBps: null,
      }),
    }));
  });

  it.each(['', '0', '1', '-2', '2.5', '521'])('rechaza el intervalo «%s» con error asociado y enfocable', async (value) => {
    const user = userEvent.setup();
    await openCreateForm(user);
    await user.selectOptions(screen.getByLabelText('Periodicidad'), 'CUSTOM_WEEKS');
    const input = screen.getByRole('spinbutton', { name: 'Se repite cada (semanas)' });
    await user.clear(input);
    if (value) await user.type(input, value);
    await user.click(screen.getByRole('button', { name: 'Guardar gasto recurrente' }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Introduce un número entero de semanas entre 2 y 520. Para una semana, elige Semanal.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.id);
    expect(input).toHaveFocus();
    expect(mocks.createRecurring).not.toHaveBeenCalled();
  });

  it('conserva el intervalo escrito al alternar y no vuelve a sugerir 4 tras vaciarlo', async () => {
    const user = userEvent.setup();
    await openCreateForm(user);
    const frequency = screen.getByLabelText('Periodicidad');
    await user.selectOptions(frequency, 'CUSTOM_WEEKS');
    await user.clear(screen.getByLabelText('Se repite cada (semanas)'));
    await user.type(screen.getByLabelText('Se repite cada (semanas)'), '3');
    await user.selectOptions(frequency, 'CUSTOM_MONTHS');
    expect(screen.queryByLabelText('Se repite cada (semanas)')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Se repite cada (meses)'), '6');
    await user.selectOptions(frequency, 'CUSTOM_WEEKS');
    expect(screen.getByLabelText('Se repite cada (semanas)')).toHaveValue(3);
    expect(screen.queryByLabelText('Se repite cada (meses)')).not.toBeInTheDocument();
    await user.selectOptions(frequency, 'CUSTOM_MONTHS');
    expect(screen.getByLabelText('Se repite cada (meses)')).toHaveValue(6);
    await user.selectOptions(frequency, 'CUSTOM_WEEKS');
    await user.clear(screen.getByLabelText('Se repite cada (semanas)'));
    await user.selectOptions(frequency, 'MONTHLY');
    await user.selectOptions(frequency, 'CUSTOM_WEEKS');
    expect(screen.getByLabelText('Se repite cada (semanas)')).toHaveValue(null);
  });

  it('edita cada 4 semanas con sus valores y presenta la misma etiqueta en listado y detalle', async () => {
    const user = userEvent.setup();
    mocks.recurring.mockResolvedValue([recurringExpense()]);
    renderPage();

    expect(await screen.findByText('Cada 4 semanas')).toBeInTheDocument();
    expect(screen.queryByText('Cada varias semanas')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver detalles' }));
    expect(screen.getAllByText('Cada 4 semanas')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Periodicidad')).toHaveValue('CUSTOM_WEEKS');
    expect(screen.getByLabelText('Se repite cada (semanas)')).toHaveValue(4);
    expect(screen.getByLabelText('Importe previsto (€)')).toHaveValue('40.00');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(mocks.updateRecurring).toHaveBeenCalledWith({
      householdId: 'household-1',
      expenseId: 'expense-1',
      body: expect.objectContaining({ frequency: 'CUSTOM_WEEKS', intervalWeeks: 4, intervalMonths: null }),
    });
  });

  it.each([
    ['MONTHLY', null, null],
    ['WEEKLY', null, null],
    ['CUSTOM_MONTHS', null, 3],
  ])('al editar semanas → %s envía solo el intervalo compatible', async (frequency, intervalWeeks, intervalMonths) => {
    const user = userEvent.setup();
    mocks.recurring.mockResolvedValue([recurringExpense()]);
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.selectOptions(screen.getByLabelText('Periodicidad'), frequency);
    expect(screen.queryByLabelText('Se repite cada (semanas)')).not.toBeInTheDocument();
    if (intervalMonths) await user.type(screen.getByLabelText('Se repite cada (meses)'), String(intervalMonths));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(mocks.updateRecurring).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ frequency, intervalWeeks, intervalMonths }),
    }));
  });

  it('al editar meses → semanas elimina los meses del payload y conserva el margen 0', async () => {
    const user = userEvent.setup();
    mocks.recurring.mockResolvedValue([recurringExpense({
      frequency: 'CUSTOM_MONTHS', intervalMonths: 3, intervalWeeks: null, safetyMarginOverrideBps: 0,
    })]);
    renderPage();
    expect(await screen.findByText('Cada 3 meses')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Se repite cada (meses)')).toHaveValue(3);
    await user.selectOptions(screen.getByLabelText('Periodicidad'), 'CUSTOM_WEEKS');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(mocks.updateRecurring).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        frequency: 'CUSTOM_WEEKS', intervalWeeks: 4, intervalMonths: null, safetyMarginOverrideBps: 0,
      }),
    }));
  });

  it('invalida calendario, presupuesto y todas las variantes de simulación al guardar', async () => {
    const user = userEvent.setup();
    const { client } = await openCreateForm(user);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await user.selectOptions(screen.getByLabelText('Periodicidad'), 'CUSTOM_WEEKS');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto recurrente' }));

    await waitFor(() => expect(screen.queryByRole('form', { name: 'Crear gasto recurrente' })).not.toBeInTheDocument());
    for (const key of ['recurringExpenses', 'calendar', 'budget', 'dashboard', 'simulation', 'plannings', 'monthlyPlanning']) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [key, 'household-1'] });
    }
  });

  it('permite llegar por teclado al intervalo con ayuda y controles adaptados al ancho disponible', async () => {
    const user = userEvent.setup();
    await openCreateForm(user);
    const frequency = screen.getByLabelText('Periodicidad');
    await user.selectOptions(frequency, 'CUSTOM_WEEKS');
    frequency.focus();
    await user.tab();
    const input = screen.getByRole('spinbutton', { name: 'Se repite cada (semanas)' });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('min', '2');
    expect(input).toHaveAttribute('max', '520');
    expect(input).toHaveAttribute('step', '1');
    expect(input).toHaveClass('w-full', 'min-h-12');
    expect(frequency.closest('.grid')).toHaveClass('sm:grid-cols-2');
    const form = screen.getByRole('form', { name: 'Crear gasto recurrente' });
    expect(within(form).getByRole('button', { name: 'Guardar gasto recurrente' })).toHaveClass('w-full');
    await user.tab({ shift: true });
    expect(frequency).toHaveFocus();
  });

  it('mantiene las semanas introducidas al fallar el guardado y permite corregirlo', async () => {
    const user = userEvent.setup();
    mocks.createRecurring.mockRejectedValueOnce(new Error('No se ha podido guardar el gasto. Inténtalo de nuevo.'));
    await openCreateForm(user);
    await user.selectOptions(screen.getByLabelText('Periodicidad'), 'CUSTOM_WEEKS');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto recurrente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido guardar el gasto. Inténtalo de nuevo.');
    expect(screen.getByLabelText('Se repite cada (semanas)')).toHaveValue(4);
    await user.click(screen.getByRole('button', { name: 'Guardar gasto recurrente' }));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Crear gasto recurrente' })).not.toBeInTheDocument());
    expect(mocks.createRecurring).toHaveBeenCalledTimes(2);
  });

  it('desactiva la acción y anuncia el guardado mientras espera al servidor', async () => {
    const user = userEvent.setup();
    let finishSave;
    mocks.createRecurring.mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve; }));
    await openCreateForm(user);
    await user.selectOptions(screen.getByLabelText('Periodicidad'), 'CUSTOM_WEEKS');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto recurrente' }));
    expect(await screen.findByRole('button', { name: 'Guardando gasto…' })).toBeDisabled();
    finishSave({ id: 'expense-1' });
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Crear gasto recurrente' })).not.toBeInTheDocument());
  });
});
