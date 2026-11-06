import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  calendar: vi.fn(),
  registerPayment: vi.fn(),
  updateRecurringPayment: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  household: { currentHousehold: { id: 'household-1', currency: 'EUR' }, isPending: false },
}));

vi.mock('../features/finance/financeService', () => ({ financeService: mocks }));
vi.mock('../features/households/useHousehold', () => ({ useHousehold: () => mocks.household }));
vi.mock('react-hot-toast', () => ({ default: { success: mocks.success, error: mocks.error } }));

import { CalendarPage } from './CalendarPage';

function occurrence(overrides = {}) {
  return {
    sourceType: 'RECURRING_EXPENSE',
    expenseId: 'gym', name: 'Gimnasio', dueDate: '2026-10-15',
    amountCents: 4_000, expectedAmountCents: 4_000, actualAmountCents: null,
    status: 'UPCOMING', scope: 'HOUSEHOLD', category: { name: 'Salud' },
    paymentId: null, paymentDate: null, notes: null,
    canRegisterPayment: true, canEditPayment: false,
    ...overrides,
  };
}

function registered(overrides = {}) {
  return occurrence({
    paymentId: 'payment-1', status: 'PAID', canRegisterPayment: false,
    canEditPayment: true, actualAmountCents: 4_200, amountCents: 4_200,
    paymentDate: '2026-09-17', notes: 'Con suplemento', ...overrides,
  });
}

function calendar(events = [occurrence()]) {
  return { view: '90_DAYS', rangeStart: '2026-09-17', rangeEnd: '2026-12-15', events };
}

// The calendar opens in the month grid; most tests exercise the cards, which the
// list view shows for every event of the month without selecting a day first.
function renderPage({ view = 'LIST' } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const result = render(<QueryClientProvider client={client}><MemoryRouter><CalendarPage /></MemoryRouter></QueryClientProvider>);
  if (view === 'LIST') fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
  return { ...result, client, invalidate };
}

function cardFor(name) {
  return screen.getByRole('heading', { name }).closest('li');
}

async function triggerFor(name, action = 'Marcar como pagado') {
  await screen.findByRole('heading', { name });
  return within(cardFor(name)).getByRole('button', { name: action });
}

async function openPaid(user) {
  const trigger = await screen.findByRole('button', { name: 'Marcar como pagado' });
  await user.click(trigger);
  return trigger;
}

describe('Calendario interactivo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-17T12:00:00Z'));
    mocks.household.currentHousehold = { id: 'household-1', currency: 'EUR' };
    mocks.household.isPending = false;
    mocks.calendar.mockResolvedValue(calendar());
    mocks.registerPayment.mockResolvedValue({ payment: { id: 'new-payment' } });
    mocks.updateRecurringPayment.mockResolvedValue({ id: 'payment-1' });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('navigates previous and next full months and returns to this month', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'septiembre de 2026' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByRole('heading', { name: 'agosto de 2026' })).toBeVisible();
    expect(mocks.calendar).toHaveBeenLastCalledWith('household-1', 'MONTH', '2026-08-01');
    expect(screen.getByRole('button', { name: 'Este mes' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Este mes' }));
    expect(screen.getByRole('heading', { name: 'septiembre de 2026' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(mocks.calendar).toHaveBeenLastCalledWith('household-1', 'MONTH', '2026-10-01');
    for (const name of ['Mes anterior', 'Este mes', 'Mes siguiente']) expect(screen.getByRole('button', { name })).toHaveClass('min-h-12', 'min-w-0');
  });

  it('crosses December into January without skipping a month on the 31st', async () => {
    vi.setSystemTime(new Date('2026-12-31T12:00:00Z'));
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByRole('heading', { name: 'enero de 2027' })).toBeVisible();
    expect(mocks.calendar).toHaveBeenLastCalledWith('household-1', 'MONTH', '2027-01-01');
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByRole('heading', { name: 'diciembre de 2026' })).toBeVisible();
  });

  it('does not display a late response from another month and leaves navigation available during loading and errors', async () => {
    let finish;
    mocks.calendar.mockImplementation((householdId, view, anchor) => anchor === '2026-08-01'
      ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(calendar([occurrence({ name: 'Gasto septiembre' })])));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Gasto septiembre');
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByText('Cargando gastos')).toBeVisible();
    expect(screen.queryByText('Gasto septiembre')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Este mes' }));
    await act(async () => finish(calendar([occurrence({ name: 'Gasto agosto' })])));
    expect(screen.queryByText('Gasto agosto')).not.toBeInTheDocument();
    expect(screen.getByText('Gasto septiembre')).toBeVisible();
    mocks.calendar.mockRejectedValue(new Error('Error de octubre'));
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(await screen.findByText('Error de octubre')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeEnabled();
  });

  it('asks before closing a payment draft when navigating months', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    await openPaid(user);
    await user.type(screen.getByLabelText('Notas (opcional)'), 'Borrador');
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Notas (opcional)')).toHaveValue('Borrador');
    expect(screen.getByRole('heading', { name: 'septiembre de 2026' })).toBeVisible();
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.queryByLabelText('Notas (opcional)')).not.toBeInTheDocument();
    expect(mocks.registerPayment).not.toHaveBeenCalled();
  });

  it('abre en la cuadrícula del mes y muestra los gastos del día seleccionado en un diálogo', async () => {
    const user = userEvent.setup();
    mocks.calendar.mockResolvedValue(calendar([occurrence({ dueDate: '2026-09-20' })]));
    renderPage({ view: 'CALENDAR' });
    expect(screen.getByRole('button', { name: 'Calendario' })).toHaveAttribute('aria-pressed', 'true');
    const day = await screen.findByRole('button', { name: /^20 sept 2026, 1 gasto, .*1 pendiente/ });
    expect(screen.queryByRole('button', { name: 'Marcar como pagado' })).not.toBeInTheDocument();
    await user.click(day);
    const dialog = screen.getByRole('dialog', { name: '20 sept 2026' });
    expect(within(dialog).getByRole('heading', { name: 'Gimnasio' })).toBeInTheDocument();
    expect(within(dialog).getByText(/^Vence el 20 sept 2026/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Marcar como pagado' }));
    expect(within(dialog).getByRole('form', { name: 'Pagar Gimnasio' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar registro de pago' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar gastos del día' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(day).toHaveFocus());
  });

  it('only offers monthly navigation without the redundant range selector', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByText('Cómo leer el calendario')).not.toBeInTheDocument();
    for (const name of ['Mes', '30 días', '90 días', 'Año']) expect(screen.queryByRole('button', { name, exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Rango del calendario' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(mocks.calendar).toHaveBeenLastCalledWith('household-1', 'MONTH', '2026-08-01');
    expect(screen.getByRole('heading', { name: 'agosto de 2026' })).toBeVisible();
  });

  it('abre el mes completo y muestra todos los tipos sin confundir registros con pagos', async () => {
    mocks.calendar.mockResolvedValue(calendar([
      occurrence(),
      { id: 'invoice', sourceType: 'INVOICE', name: 'Luz', dueDate: '2026-09-02', dateBasis: 'CHARGE_DATE', status: 'RECORDED', amountCents: 2300, scope: 'HOUSEHOLD' },
      { id: 'variable', sourceType: 'VARIABLE_EXPENSE', name: 'Supermercado', dueDate: '2026-09-02', status: 'RECORDED', amountCents: 1800, scope: 'HOUSEHOLD' },
      { id: 'summary', sourceType: 'VARIABLE_SUMMARY', name: 'Comida', dueDate: '2026-09-01', datePrecision: 'MONTH', status: 'RECORDED', amountCents: 0, scope: 'HOUSEHOLD' },
      { id: 'one-time', sourceType: 'ONE_TIME_EXPENSE', name: 'Reparación', dueDate: '2026-09-02', status: 'UNCONFIRMED', amountCents: 4900, expectedAmountCents: 4900, scope: 'HOUSEHOLD' },
    ]));
    const user = userEvent.setup();
    renderPage();
    const cards = await screen.findAllByRole('listitem');
    expect(mocks.calendar).toHaveBeenCalledWith('household-1', 'MONTH', '2026-09-01');
    expect(screen.getByRole('button', { name: 'Este mes' })).toHaveAttribute('aria-pressed', 'true');
    expect(cards).toHaveLength(5);
    const invoice = cardFor('Luz');
    expect(invoice).toHaveTextContent('Se cobra el 2 sept 2026');
    expect(invoice).toHaveTextContent('Importe registrado');
    expect(within(invoice).getByRole('link', { name: 'Ver facturas' })).toHaveAttribute('href', '/facturas');
    const variable = cardFor('Supermercado');
    expect(variable).toHaveTextContent('18,00');
    expect(within(variable).getByRole('link', { name: 'Ver gastos variables' })).toHaveAttribute('href', '/gastos/variables');
    // A whole-month total has no concrete day: it is listed apart from the dated cards.
    const monthly = within(screen.getByRole('region', { name: 'Gastos del mes sin día concreto' })).getByText('Comida').closest('li');
    expect(monthly).toHaveTextContent('Total mensual variable');
    expect(monthly).toHaveTextContent('0,00');
    const oneTime = cardFor('Reparación');
    expect(oneTime).toHaveTextContent('Sin pago confirmado');
    expect(oneTime).toHaveTextContent('Importe previsto');
    expect(within(oneTime).getByRole('link', { name: 'Ver gastos puntuales' })).toHaveAttribute('href', '/gastos/puntuales');
    for (const card of [invoice, variable, monthly, oneTime]) {
      // Records only offer confirming their payment date, never the recurring payment actions.
      // Recorded expenses only offer a direct "Marcar como pagado": never the
      // recurring-payment form actions (skip / edit record).
      for (const name of ['Omitir', 'Editar registro']) expect(within(card).queryByRole('button', { name })).not.toBeInTheDocument();
      expect(within(card).getAllByRole('button', { name: 'Marcar como pagado' })).toHaveLength(1);
      expect(within(card).getByRole('button', { name: 'Marcar como pagado' })).not.toHaveAttribute('aria-controls');
      // Paid today by default: the date field only appears for another day.
      expect(within(card).queryByLabelText('Fecha de pago')).not.toBeInTheDocument();
      await user.click(within(card).getByRole('button', { name: '¿Otro día?' }));
      expect(within(card).getByLabelText('Fecha de pago')).toBeVisible();
      expect(within(card).queryByText('Pagado')).not.toBeInTheDocument();
      expect(within(card).queryByText('Atrasado')).not.toBeInTheDocument();
    }
  });

  it('conserva distintas facturas del mismo día al refrescar el calendario', async () => {
    const invoice = { sourceType: 'INVOICE', dueDate: '2026-09-02', status: 'RECORDED', amountCents: 100, scope: 'HOUSEHOLD' };
    mocks.calendar.mockResolvedValue(calendar([{ ...invoice, id: 'first', name: 'Primera factura' }, { ...invoice, id: 'second', name: 'Segunda factura' }]));
    const { client } = renderPage();
    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
    await act(async () => { client.setQueryData(['calendar', 'household-1', 'MONTH', '2026-09-01'], calendar([{ ...invoice, id: 'second', name: 'Segunda factura actualizada', amountCents: 300 }])); });
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.queryByText('Primera factura')).not.toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('Segunda factura actualizada');
    expect(screen.getByRole('listitem')).toHaveTextContent('3,00');
  });

  it('solo ofrece acciones para el evento autorizado por backend, no sus proyecciones', async () => {
    mocks.calendar.mockResolvedValue(calendar([
      occurrence(),
      occurrence({ dueDate: '2026-11-12', canRegisterPayment: false }),
      occurrence({ dueDate: '2026-12-10', canRegisterPayment: false }),
    ]));
    renderPage();
    const cards = await screen.findAllByRole('listitem');
    expect(within(cards[0]).getByRole('button', { name: 'Marcar como pagado' })).toBeEnabled();
    expect(within(cards[0]).getByRole('button', { name: 'Omitir' })).toBeEnabled();
    expect(within(cards[1]).queryByRole('button')).not.toBeInTheDocument();
    expect(within(cards[2]).queryByRole('button')).not.toBeInTheDocument();
  });

  it('no deduce permisos de la fecha o del estado si el backend no los concede', async () => {
    mocks.calendar.mockResolvedValue(calendar([
      occurrence({ status: 'OVERDUE', dueDate: '2026-09-10', canRegisterPayment: false }),
      registered({ name: 'Sin permiso', canEditPayment: false }),
      occurrence({ expenseId: 'legacy', name: 'Contrato antiguo', canRegisterPayment: undefined }),
    ]));
    renderPage();
    await screen.findByText('Contrato antiguo');
    expect(screen.queryByRole('button', { name: 'Marcar como pagado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar registro' })).not.toBeInTheDocument();
  });

  it('abre Pagado con importe previsto, hoy, notas vacías y foco accesible', async () => {
    const user = userEvent.setup();
    renderPage();
    const trigger = await openPaid(user);
    const form = screen.getByRole('form', { name: 'Pagar Gimnasio' });
    expect(screen.getByLabelText('Importe real (€)')).toHaveValue('40.00');
    expect(screen.getByLabelText('Fecha de pago')).toHaveValue('2026-09-17');
    expect(screen.getByLabelText('Notas (opcional)')).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Pagado' })).toBeChecked();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', form.id);
    expect(form).toContainElement(document.activeElement);
    expect(screen.getByLabelText('Fecha de pago')).toHaveClass('min-w-0', 'max-w-full');
  });

  it('guarda PAID anticipado sin confundir vencimiento y fecha real, e invalida las queries', async () => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();
    await openPaid(user);
    await user.type(screen.getByLabelText('Notas (opcional)'), 'Pago anticipado');
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));
    await waitFor(() => expect(mocks.registerPayment).toHaveBeenCalledWith({
      householdId: 'household-1', expenseId: 'gym', body: {
        status: 'PAID', dueDate: '2026-10-15', expectedAmountCents: 4_000,
        actualAmountCents: 4_000, paymentDate: '2026-09-17', notes: 'Pago anticipado',
        nextAmountDecision: 'KEEP_PREVIOUS', nextExpectedAmountCents: null,
      },
    }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Pago registrado.'));
    for (const queryKey of [['calendar', 'household-1'], ['recurringExpenses', 'household-1'], ['recurringExpenses', 'household-1', 'payments', 'gym'], ['dashboard', 'household-1']]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    }
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('permite registrar un atrasado conservando la fecha del vencimiento', async () => {
    const user = userEvent.setup();
    mocks.calendar.mockResolvedValue(calendar([occurrence({ status: 'OVERDUE', dueDate: '2026-09-10' })]));
    renderPage();
    await openPaid(user);
    expect(screen.getByText('Atrasado')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));
    await waitFor(() => expect(mocks.registerPayment).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ dueDate: '2026-09-10', paymentDate: '2026-09-17', status: 'PAID' }) })));
  });

  it('actualiza opcionalmente el próximo importe y refresca presupuesto, planificación y simulación', async () => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();
    await openPaid(user);
    await user.clear(screen.getByLabelText('Importe real (€)'));
    await user.type(screen.getByLabelText('Importe real (€)'), '42');
    await user.click(screen.getByRole('checkbox', { name: /próximo vencimiento/i }));
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));
    await waitFor(() => expect(mocks.registerPayment).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ actualAmountCents: 4_200, nextAmountDecision: 'UPDATE_NEXT_AMOUNT', nextExpectedAmountCents: 4_200 }) })));
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
    for (const prefix of ['budget', 'plannings', 'simulation', 'monthlyPlanning']) expect(invalidate).toHaveBeenCalledWith({ queryKey: [prefix, 'household-1'] });
  });

  it('Omitir abre confirmación con notas y no registra por un toque accidental', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Omitir' }));
    expect(mocks.registerPayment).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Omitido' })).toBeChecked();
    expect(screen.queryByLabelText('Importe real (€)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fecha de pago')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Notas (opcional)'), 'Pausa de vacaciones');
    await user.click(screen.getByRole('button', { name: 'Confirmar omisión' }));
    await waitFor(() => expect(mocks.registerPayment).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ status: 'SKIPPED', actualAmountCents: null, paymentDate: null, notes: 'Pausa de vacaciones', nextAmountDecision: 'KEEP_PREVIOUS', nextExpectedAmountCents: null }) })));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Vencimiento omitido.'));
  });

  it('solo abre un formulario a la vez y cambiar de tarjeta descarta el borrador anterior', async () => {
    const user = userEvent.setup();
    mocks.calendar.mockResolvedValue(calendar([occurrence(), occurrence({ expenseId: 'rent', name: 'Alquiler' })]));
    renderPage();
    // Cards of the same day are sorted by name: open Gimnasio first, then Alquiler.
    const triggers = [await triggerFor('Gimnasio'), await triggerFor('Alquiler')];
    await user.click(triggers[0]);
    await user.type(screen.getByLabelText('Notas (opcional)'), 'Borrador');
    await user.click(triggers[1]);
    expect(screen.getAllByRole('form')).toHaveLength(1);
    expect(screen.getByRole('form', { name: 'Pagar Alquiler' })).toBeInTheDocument();
    expect(screen.getByLabelText('Notas (opcional)')).toHaveValue('');
    expect(triggers[0]).toHaveAttribute('aria-expanded', 'false');
  });

  it('cancela sin guardar y devuelve el foco al botón de apertura', async () => {
    const user = userEvent.setup();
    renderPage();
    const trigger = await openPaid(user);
    await user.click(screen.getByRole('button', { name: 'Cancelar registro de pago' }));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(mocks.registerPayment).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('permite abrir, recorrer todos los campos y cancelar solo con teclado', async () => {
    const user = userEvent.setup();
    renderPage();
    const trigger = await screen.findByRole('button', { name: 'Marcar como pagado' });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('radio', { name: 'Pagado' })).toHaveFocus();
    for (const field of [
      screen.getByLabelText('Importe real (€)'),
      screen.getByLabelText('Fecha de pago'),
      screen.getByRole('checkbox'),
      screen.getByLabelText('Notas (opcional)'),
      screen.getByRole('button', { name: 'Guardar pago' }),
      screen.getByRole('button', { name: 'Cancelar', exact: true }),
    ]) {
      await user.tab();
      expect(field).toHaveFocus();
    }
    await user.keyboard('{Enter}');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(mocks.registerPayment).not.toHaveBeenCalled();
  });

  it('muestra importe y fecha reales de PAID y permite corregirlo sin cambiar el futuro', async () => {
    const user = userEvent.setup();
    mocks.calendar.mockResolvedValue(calendar([registered()]));
    const { invalidate } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Editar registro' }));
    expect(screen.getByText(/^42,00/)).toBeInTheDocument();
    expect(screen.getByText(/Fecha de pago:.*17.*sept/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Importe real (€)')).toHaveValue('42.00');
    expect(screen.getByLabelText('Notas (opcional)')).toHaveValue('Con suplemento');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Importe real (€)'));
    await user.type(screen.getByLabelText('Importe real (€)'), '41');
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }));
    await waitFor(() => expect(mocks.updateRecurringPayment).toHaveBeenCalledWith({ householdId: 'household-1', expenseId: 'gym', paymentId: 'payment-1', body: { status: 'PAID', actualAmountCents: 4_100, paymentDate: '2026-09-17', notes: 'Con suplemento' } }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Registro actualizado.'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['calendar', 'household-1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'] });
    expect(mocks.registerPayment).not.toHaveBeenCalled();
  });

  it('corrige PAID a SKIPPED limpiando importe/fecha sin enviar instrucciones de futuro', async () => {
    const user = userEvent.setup();
    mocks.calendar.mockResolvedValue(calendar([registered()]));
    const { invalidate } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Editar registro' }));
    await user.click(screen.getByRole('radio', { name: 'Omitido' }));
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }));
    await waitFor(() => expect(mocks.updateRecurringPayment).toHaveBeenCalledWith(expect.objectContaining({ body: { status: 'SKIPPED', actualAmountCents: null, paymentDate: null, notes: 'Con suplemento' } })));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'] }));
  });

  it('muestra Omitido y permite corregirlo a PAID con importe y fecha', async () => {
    const user = userEvent.setup();
    mocks.calendar.mockResolvedValue(calendar([registered({ status: 'SKIPPED', actualAmountCents: null, paymentDate: null, notes: null })]));
    renderPage();
    expect(await screen.findByText('Omitido')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editar registro' }));
    expect(screen.queryByLabelText('Fecha de pago')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Pagado' }));
    fireEvent.change(screen.getByLabelText('Fecha de pago'), { target: { value: '2026-09-16' } });
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }));
    await waitFor(() => expect(mocks.updateRecurringPayment).toHaveBeenCalledWith(expect.objectContaining({ body: { status: 'PAID', actualAmountCents: 4_000, paymentDate: '2026-09-16', notes: null } })));
  });

  it.each(['PAYMENT_ALREADY_REGISTERED', 'PAYMENT_NOT_CURRENT_OCCURRENCE'])('refresca y cierra un formulario obsoleto ante %s', async (code) => {
    const user = userEvent.setup();
    mocks.registerPayment.mockRejectedValue(Object.assign(new Error('Conflicto'), { code, status: 409 }));
    const { invalidate } = renderPage();
    await openPaid(user);
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    expect(mocks.calendar.mock.calls.length).toBeGreaterThan(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['calendar', 'household-1'] });
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('mantiene un error de red junto al formulario para poder reintentar', async () => {
    const user = userEvent.setup();
    mocks.registerPayment.mockRejectedValue(Object.assign(new Error('No hay conexión.'), { code: 'NETWORK_ERROR' }));
    renderPage();
    await openPaid(user);
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));
    expect(await screen.findByText('No hay conexión.')).toBeInTheDocument();
    expect(screen.getByRole('form')).toBeInTheDocument();
  });

  it('refresca las ocurrencias de cuatro semanas: pagado, omitido y siguiente accionable', async () => {
    const user = userEvent.setup();
    const october = occurrence();
    const november = occurrence({ dueDate: '2026-11-12', canRegisterPayment: false });
    const december = occurrence({ dueDate: '2026-12-10', canRegisterPayment: false });
    mocks.calendar.mockResolvedValue(calendar([october, november, december]));
    renderPage();
    await openPaid(user);
    mocks.calendar.mockResolvedValue(calendar([registered({ actualAmountCents: 4_000 }), { ...november, canRegisterPayment: true }, december]));
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    let cards = screen.getAllByRole('listitem');
    expect(within(cards[0]).getByText('Pagado')).toBeInTheDocument();
    expect(within(cards[1]).getByRole('button', { name: 'Marcar como pagado' })).toBeInTheDocument();
    expect(within(cards[2]).queryByRole('button')).not.toBeInTheDocument();
    await user.click(within(cards[1]).getByRole('button', { name: 'Omitir' }));
    mocks.calendar.mockResolvedValue(calendar([registered(), registered({ dueDate: '2026-11-12', paymentId: 'payment-2', status: 'SKIPPED', actualAmountCents: null, paymentDate: null }), { ...december, canRegisterPayment: true }]));
    await user.click(screen.getByRole('button', { name: 'Confirmar omisión' }));
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    cards = screen.getAllByRole('listitem');
    expect(within(cards[1]).getByText('Omitido')).toBeInTheDocument();
    expect(within(cards[2]).getByRole('button', { name: 'Marcar como pagado' })).toBeInTheDocument();
  });

  it('una respuesta tardía no cierra el formulario abierto en otra tarjeta', async () => {
    const user = userEvent.setup();
    let resolveSave;
    mocks.registerPayment.mockImplementation(() => new Promise((resolve) => { resolveSave = resolve; }));
    mocks.calendar.mockResolvedValue(calendar([occurrence(), occurrence({ expenseId: 'rent', name: 'Alquiler' })]));
    renderPage();
    const triggers = [await triggerFor('Gimnasio'), await triggerFor('Alquiler')];
    await user.click(triggers[0]);
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));
    await waitFor(() => expect(resolveSave).toBeTypeOf('function'));
    await user.click(triggers[1]);
    await act(async () => { resolveSave({ payment: { id: 'new-payment' } }); });
    expect(screen.getByRole('form', { name: 'Pagar Alquiler' })).toBeInTheDocument();
  });

  it('cambiar mes cierra el formulario tras confirmarlo y conserva la navegación accesible', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await openPaid(user);
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Este mes' })).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(mocks.calendar).toHaveBeenCalledWith('household-1', 'MONTH', '2026-10-01'));
    for (const name of ['Mes anterior', 'Este mes', 'Mes siguiente']) expect(screen.getByRole('button', { name })).toHaveClass('min-h-12');
    expect(screen.getByRole('group', { name: 'Cambiar mes' })).toHaveClass('grid-cols-3');
  });

  it('un refresco externo que resuelve el vencimiento cierra el borrador y restaura el foco', async () => {
    const user = userEvent.setup();
    const { client } = renderPage();
    await openPaid(user);
    await user.click(screen.getByLabelText('Notas (opcional)'));
    await act(async () => { client.setQueryData(['calendar', 'household-1', 'MONTH', '2026-09-01'], calendar([registered()])); });
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Gimnasio' })).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Editar registro' })).toHaveAttribute('aria-expanded', 'false');
    expect(mocks.registerPayment).not.toHaveBeenCalled();
  });

  it('si desaparece la tarjeta durante un refresco, cierra el borrador y enfoca el calendario', async () => {
    const user = userEvent.setup();
    const { client, container } = renderPage();
    await openPaid(user);
    await user.click(screen.getByLabelText('Notas (opcional)'));
    await act(async () => { client.setQueryData(['calendar', 'household-1', 'MONTH', '2026-09-01'], calendar([])); });
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    await waitFor(() => expect(container.firstElementChild).toHaveFocus());
    expect(mocks.registerPayment).not.toHaveBeenCalled();
  });

  it('presenta scope/categoría y permite textos largos sin mínimos rígidos en tarjetas', async () => {
    const longName = 'GastoPersonalConUnNombreLargoSinSeparadores'.repeat(4);
    mocks.calendar.mockResolvedValue(calendar([occurrence({ name: longName, scope: 'PERSONAL', personalPerson: { name: 'Pablo' } })]));
    renderPage();
    expect(await screen.findByText('Personal · Pablo · Salud')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: longName })).toHaveClass('break-words');
    expect(screen.getByRole('listitem')).toHaveClass('min-w-0');
  });

  it('muestra vacío, carga y error con opción de reintento', async () => {
    const user = userEvent.setup();
    mocks.calendar.mockRejectedValueOnce(new Error('Calendario no disponible.'));
    mocks.calendar.mockResolvedValue(calendar([]));
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando gastos');
    expect(await screen.findByText('Calendario no disponible.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver a intentarlo' }));
    expect(await screen.findByText('No hay gastos para este mes. Puedes añadirlos desde Gastos.')).toHaveAttribute('role', 'status');
  });

  it('sin hogar no consulta calendario ni ofrece acciones de pago', () => {
    mocks.household.currentHousehold = null;
    renderPage({ view: 'CALENDAR' });
    expect(screen.getByRole('heading', { name: 'No hay un hogar seleccionado' })).toBeInTheDocument();
    expect(mocks.calendar).not.toHaveBeenCalled();
  });
});
