import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ calendar: vi.fn(), detail: vi.fn(), pay: vi.fn(), correct: vi.fn(), recurringPay: vi.fn(), recurringCorrect: vi.fn(), success: vi.fn(), error: vi.fn(), household: { currentHousehold: { id: 'home', currency: 'EUR', timezone: 'Europe/Madrid' }, isPending: false } }));
vi.mock('../features/finance/financeService', () => ({ financeService: { calendar: mocks.calendar, registerPayment: mocks.recurringPay, updateRecurringPayment: mocks.recurringCorrect } }));
vi.mock('../features/purchases/purchasesService', () => ({ purchasesService: { detail: mocks.detail } }));
vi.mock('../features/purchases/purchasePaymentsService', async (original) => ({ ...await original(), purchasePaymentsService: { pay: mocks.pay, correct: mocks.correct } }));
vi.mock('../features/households/useHousehold', () => ({ useHousehold: () => mocks.household }));
vi.mock('react-hot-toast', () => ({ default: { success: mocks.success, error: mocks.error } }));

import { CalendarPage } from './CalendarPage';

const first = { id: 'i1', sequence: 1, dueDate: '2026-10-15', expectedAmountCents: 10000, actualAmountCents: null, paidAt: null, notes: null, status: 'PLANNED', canRegisterPayment: true };
const next = { ...first, id: 'i2', sequence: 2, dueDate: '2026-11-15', canRegisterPayment: false };
const purchase = { id: 'purchase', paymentMethod: 'FINANCED', financing: { installments: [first, next] } };
const event = { sourceType: 'PURCHASE_INSTALLMENT', purchaseId: 'purchase', installmentId: 'i1', sequence: 1, installmentCount: 20, name: 'Móvil · Cuota 1/20', scope: 'PERSONAL', ownershipType: 'SPLIT', shareBps: 6000, dueDate: '2026-10-15', paymentDate: null, status: 'UPCOMING', amountCents: 6000, expectedAmountCents: 6000, actualAmountCents: null, canAccessPurchase: true, canRegisterPayment: true, canEditPayment: false };
const calendar = (events = [event]) => ({ rangeStart: '2026-09-17', rangeEnd: '2026-12-15', events });
const paidEvent = (overrides = {}) => ({ ...event, status: 'PAID', paymentDate: '2026-09-17', amountCents: 6240, actualAmountCents: 6240, canRegisterPayment: false, canEditPayment: true, ...overrides });
const paidPurchase = () => ({ ...purchase, financing: { installments: [{ ...first, status: 'PAID', paidAt: '2026-09-17', actualAmountCents: 10400, notes: 'Anticipada', canRegisterPayment: false }, { ...next, canRegisterPayment: true }] } });

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const tree = () => <QueryClientProvider client={client}><MemoryRouter><CalendarPage /></MemoryRouter></QueryClientProvider>;
  const view = render(tree());
  return { ...view, client, invalidate, refresh: () => view.rerender(tree()) };
}

describe('Calendar purchase payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-17T12:00:00Z'));
    mocks.household.currentHousehold = { id: 'home', currency: 'EUR', timezone: 'Europe/Madrid' };
    mocks.calendar.mockResolvedValue(calendar());
    mocks.detail.mockResolvedValue(purchase);
    mocks.pay.mockResolvedValue(paidPurchase());
    mocks.correct.mockResolvedValue(paidPurchase());
  });
  afterEach(() => vi.useRealTimers());

  it('distinguishes installment from recurring source and never offers omission for a purchase', async () => {
    mocks.calendar.mockResolvedValue(calendar([event, { sourceType: 'RECURRING_EXPENSE', expenseId: 'gym', dueDate: '2026-10-15', name: 'Gimnasio', status: 'UPCOMING', expectedAmountCents: 4000, canRegisterPayment: true, scope: 'HOUSEHOLD' }]));
    setup();
    const purchaseCard = (await screen.findByRole('heading', { name: event.name })).closest('li');
    const recurringCard = screen.getByRole('heading', { name: 'Gimnasio' }).closest('li');
    expect(within(purchaseCard).getByText('Cuota de compra')).toBeInTheDocument();
    expect(within(purchaseCard).queryByRole('button', { name: 'Omitir' })).not.toBeInTheDocument();
    expect(within(recurringCard).getByText('Gasto recurrente')).toBeInTheDocument();
    expect(within(recurringCard).getByRole('button', { name: 'Omitir' })).toBeInTheDocument();
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it('shows only the viewer split allocation without loading the private purchase until requested', async () => {
    setup();
    const card = (await screen.findByRole('heading', { name: event.name })).closest('li');
    expect(card).toHaveTextContent('Tu parte de una compra repartida (60 %)');
    expect(card).toHaveTextContent('Tu parte prevista');
    expect(card).toHaveTextContent('60,00');
    expect(card).not.toHaveTextContent('100,00');
    expect(card).not.toHaveTextContent('40,00');
    expect(within(card).getByRole('link', { name: /Ver compra/ })).toHaveAttribute('href', '/compras/purchase');
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it('opens the authorized complete installment, clearly distinguishing full payment from viewer allocation', async () => {
    const user = userEvent.setup(); setup();
    const button = await screen.findByRole('button', { name: 'Marcar pagado' });
    await user.click(button);
    const form = await screen.findByRole('form', { name: 'Pagar de cuota 1' });
    expect(within(form).getByLabelText('Importe real (€)')).toHaveValue('100.00');
    expect(within(form).getByLabelText('Importe real (€)')).toHaveFocus();
    expect(screen.getByText(/Aquí registras el importe total pagado de la cuota/)).toBeInTheDocument();
    expect(document.getElementById(button.getAttribute('aria-controls'))).toContainElement(form);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(mocks.detail.mock.calls[0][0]).toMatchObject({ householdId: 'home', purchaseId: 'purchase', signal: expect.any(AbortSignal) });
    expect(screen.queryByRole('radio', { name: 'Omitido' })).not.toBeInTheDocument();
  });

  it('pays anticipatively through PurchaseInstallment and invalidates the shared financial views', async () => {
    const user = userEvent.setup(); const { invalidate } = setup();
    await user.click(await screen.findByRole('button', { name: 'Marcar pagado' }));
    await screen.findByRole('form');
    await user.clear(screen.getByLabelText('Importe real (€)'));
    await user.type(screen.getByLabelText('Importe real (€)'), '104');
    await user.type(screen.getByLabelText('Notas del pago (opcional)'), 'Anticipada');
    await user.click(screen.getByRole('button', { name: 'Guardar pago de cuota' }));
    await waitFor(() => expect(mocks.pay.mock.calls[0][0]).toEqual({ householdId: 'home', purchaseId: 'purchase', installmentId: 'i1', body: { actualAmountCents: 10400, paidAt: '2026-09-17', notes: 'Anticipada' } }));
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    expect(mocks.recurringPay).not.toHaveBeenCalled();
    expect(mocks.recurringCorrect).not.toHaveBeenCalled();
    for (const prefix of ['budget', 'dashboard', 'calendar', 'simulation', 'plannings', 'monthlyPlanning']) expect(invalidate).toHaveBeenCalledWith({ queryKey: [prefix, 'home'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['purchases', 'home', 'detail', 'purchase'], exact: true });
    expect(mocks.success).toHaveBeenCalledWith('Cuota registrada como pagada.');
  });

  it('enables only the first pending installment, then the next after paying', async () => {
    const user = userEvent.setup();
    const nextEvent = { ...event, installmentId: 'i2', sequence: 2, name: 'Móvil · Cuota 2/20', dueDate: next.dueDate, canRegisterPayment: false };
    mocks.calendar.mockResolvedValue(calendar([event, nextEvent]));
    mocks.pay.mockImplementation(async () => {
      mocks.detail.mockResolvedValue(paidPurchase());
      mocks.calendar.mockResolvedValue(calendar([paidEvent(), { ...nextEvent, canRegisterPayment: true }]));
      return paidPurchase();
    });
    setup();
    const cards = await screen.findAllByRole('listitem');
    expect(within(cards[1]).queryByRole('button')).not.toBeInTheDocument();
    await user.click(within(cards[0]).getByRole('button', { name: 'Marcar pagado' }));
    await user.click(await screen.findByRole('button', { name: 'Guardar pago de cuota' }));
    await waitFor(() => expect(within(screen.getAllByRole('listitem')[1]).getByRole('button', { name: 'Marcar pagado' })).toBeInTheDocument());
    expect(within(screen.getAllByRole('listitem')[0]).getByText('Pagado')).toBeInTheDocument();
    expect(within(screen.getAllByRole('listitem')[0]).queryByRole('button', { name: 'Marcar pagado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Omitir' })).not.toBeInTheDocument();
  });

  it('never guesses permission from overdue dates or PLANNED status', async () => {
    mocks.calendar.mockResolvedValue(calendar([{ ...event, dueDate: '2026-09-01', status: 'OVERDUE', canRegisterPayment: false }]));
    setup();
    await screen.findByText('Atrasado');
    expect(screen.queryByRole('button', { name: 'Marcar pagado' })).not.toBeInTheDocument();
  });

  it('shows paid actual share separately from expected obligation and edits using full recorded amount', async () => {
    const user = userEvent.setup();
    mocks.calendar.mockResolvedValue(calendar([paidEvent()]));
    mocks.detail.mockResolvedValue(paidPurchase());
    setup();
    const card = (await screen.findByRole('heading', { name: event.name })).closest('li');
    expect(card).toHaveTextContent('Tu parte pagada');
    expect(card).toHaveTextContent('62,40');
    expect(card).toHaveTextContent('Previsto para este vencimiento: 60,00');
    await user.click(within(card).getByRole('button', { name: 'Editar pago de cuota' }));
    const form = await screen.findByRole('form', { name: 'Editar pago de cuota 1' });
    expect(within(form).getByLabelText('Importe real (€)')).toHaveValue('104.00');
    await user.clear(within(form).getByLabelText('Importe real (€)'));
    await user.type(within(form).getByLabelText('Importe real (€)'), '102');
    await user.click(within(form).getByRole('button', { name: 'Guardar corrección del pago' }));
    await waitFor(() => expect(mocks.correct.mock.calls[0][0]).toMatchObject({ installmentId: 'i1', body: { actualAmountCents: 10200 } }));
    expect(mocks.pay).not.toHaveBeenCalled();
    expect(mocks.recurringCorrect).not.toHaveBeenCalled();
  });

  it.each([
    ['PURCHASE_UPFRONT', 'Compra al contado'], ['PURCHASE_DOWN_PAYMENT', 'Entrada de compra'],
  ])('shows %s as its own source with a detail link, never installment actions', async (sourceType, label) => {
    mocks.calendar.mockResolvedValue(calendar([{ ...event, sourceType, installmentId: null, name: label, canRegisterPayment: true, canEditPayment: true }]));
    setup();
    const card = (await screen.findByRole('heading', { name: label })).closest('li');
    expect(within(card).getByRole('link', { name: /Ver compra/ })).toBeInTheDocument();
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('historical allocations with revoked purchase access have no revealing link or payment action', async () => {
    mocks.calendar.mockResolvedValue(calendar([paidEvent({ name: 'Compra personal (histórico)', canAccessPurchase: false, canEditPayment: false })]));
    setup();
    await screen.findByRole('heading', { name: 'Compra personal (histórico)' });
    expect(screen.queryByRole('link', { name: /Ver compra/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar pago de cuota' })).not.toBeInTheDocument();
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it('loading purchase details is cancellable and restores keyboard focus', async () => {
    const user = userEvent.setup();
    mocks.detail.mockReturnValue(new Promise(() => {}));
    setup();
    const trigger = await screen.findByRole('button', { name: 'Marcar pagado' });
    await user.click(trigger);
    expect(screen.getByText('Cargando datos del pago de compra')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(mocks.pay).not.toHaveBeenCalled();
  });

  it('failed private detail shows an actionable error without falling back to the visible partial amount', async () => {
    const user = userEvent.setup();
    mocks.detail.mockRejectedValue(new Error('No se puede abrir la compra.'));
    setup();
    await user.click(await screen.findByRole('button', { name: 'Marcar pagado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede abrir la compra.');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    mocks.detail.mockResolvedValue(purchase);
    await user.click(screen.getByRole('button', { name: 'Volver a intentarlo' }));
    expect(await screen.findByLabelText('Importe real (€)')).toHaveValue('100.00');
  });

  it('refuses a stale actionable event when the authoritative installment is no longer eligible', async () => {
    const user = userEvent.setup();
    mocks.detail.mockResolvedValue({ ...purchase, financing: { installments: [{ ...first, canRegisterPayment: false }] } });
    setup();
    await user.click(await screen.findByRole('button', { name: 'Marcar pagado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta cuota ya no admite esta acción');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(mocks.pay).not.toHaveBeenCalled();
  });

  it.each(['create', 'edit'])('does not silently switch a %s draft to the opposite payment action after an external update', async (mode) => {
    const user = userEvent.setup();
    if (mode === 'edit') {
      mocks.calendar.mockResolvedValue(calendar([paidEvent()]));
      mocks.detail.mockResolvedValue(paidPurchase());
    }
    const { client } = setup();
    await user.click(await screen.findByRole('button', { name: mode === 'edit' ? 'Editar pago de cuota' : 'Marcar pagado' }));
    await screen.findByRole('form');
    act(() => client.setQueryData(['purchases', 'home', 'detail', 'purchase'], mode === 'edit' ? purchase : paidPurchase()));
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta cuota ya no admite esta acción');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(mocks.pay).not.toHaveBeenCalled();
    expect(mocks.correct).not.toHaveBeenCalled();
  });

  it('handles a removed installment during an in-flight save without passing an absent installment to the form', async () => {
    const user = userEvent.setup();
    let reject;
    mocks.pay.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    const { client } = setup();
    await user.click(await screen.findByRole('button', { name: 'Marcar pagado' }));
    await user.click(await screen.findByRole('button', { name: 'Guardar pago de cuota' }));
    act(() => client.setQueryData(['purchases', 'home', 'detail', 'purchase'], { ...purchase, paymentMethod: 'UPFRONT', financing: null }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta cuota ya no admite esta acción');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await act(async () => reject(Object.assign(new Error('La compra ya no está financiada.'), { status: 409 })));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument());
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.correct).not.toHaveBeenCalled();
  });

  it('does not show cached full-payment details while rechecking private access', async () => {
    const user = userEvent.setup();
    let reject;
    mocks.detail.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    const { client } = setup();
    client.setQueryData(['purchases', 'home', 'detail', 'purchase'], purchase);
    await user.click(await screen.findByRole('button', { name: 'Marcar pagado' }));
    expect(screen.getByText('Cargando datos del pago de compra')).toBeInTheDocument();
    expect(screen.queryByLabelText('Importe real (€)')).not.toBeInTheDocument();
    mocks.calendar.mockResolvedValue(calendar([paidEvent({ name: 'Compra personal (histórico)', canAccessPurchase: false, canEditPayment: false })]));
    await act(async () => reject(Object.assign(new Error('Compra no disponible.'), { status: 404 })));
    await waitFor(() => expect(screen.queryByRole('heading', { name: event.name })).not.toBeInTheDocument());
    expect(await screen.findByRole('heading', { name: 'Compra personal (histórico)' })).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(mocks.pay).not.toHaveBeenCalled();
  });

  it('retains entered values on network error and prevents duplicate submissions', async () => {
    const user = userEvent.setup();
    let reject;
    mocks.pay.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    setup();
    await user.click(await screen.findByRole('button', { name: 'Marcar pagado' }));
    await user.type(await screen.findByLabelText('Notas del pago (opcional)'), 'No perder');
    await user.dblClick(screen.getByRole('button', { name: 'Guardar pago de cuota' }));
    expect(mocks.pay).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Guardando pago…' })).toBeDisabled();
    await act(async () => reject(new Error('No hay conexión.')));
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión.');
    expect(screen.getByLabelText('Notas del pago (opcional)')).toHaveValue('No perder');
  });

  it('conflicts refresh financial state and close the stale form instead of claiming success', async () => {
    const user = userEvent.setup();
    mocks.pay.mockRejectedValue(Object.assign(new Error('Existe una cuota anterior pendiente.'), { status: 409 }));
    const { invalidate } = setup();
    await user.click(await screen.findByRole('button', { name: 'Marcar pagado' }));
    await user.click(await screen.findByRole('button', { name: 'Guardar pago de cuota' }));
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['calendar', 'home'] });
    expect(mocks.error).toHaveBeenCalledWith('Existe una cuota anterior pendiente.');
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('a late payment response does not publish private detail or close another calendar draft', async () => {
    const user = userEvent.setup(); let resolve;
    mocks.pay.mockReturnValue(new Promise((done) => { resolve = done; }));
    mocks.calendar.mockResolvedValue(calendar([event, { ...event, purchaseId: 'other-purchase', installmentId: 'i-other', name: 'Otra compra' }]));
    const { client } = setup();
    const buttons = await screen.findAllByRole('button', { name: 'Marcar pagado' });
    await user.click(buttons[0]);
    await user.click(await screen.findByRole('button', { name: 'Guardar pago de cuota' }));
    mocks.detail.mockResolvedValue({ id: 'other-purchase', financing: { installments: [{ ...first, id: 'i-other' }] } });
    await user.click(buttons[1]);
    const other = await screen.findByRole('form');
    client.removeQueries({ queryKey: ['purchases', 'home', 'detail', 'purchase'], exact: true });
    await act(async () => resolve(paidPurchase()));
    expect(other).toBeInTheDocument();
    expect(client.getQueryData(['purchases', 'home', 'detail', 'purchase'])).toBeUndefined();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('changing household discards a purchase payment draft and prevents late feedback or cache publication', async () => {
    const user = userEvent.setup(); let resolve;
    mocks.pay.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { client, refresh } = setup();
    await user.click(await screen.findByRole('button', { name: 'Marcar pagado' }));
    await user.click(await screen.findByRole('button', { name: 'Guardar pago de cuota' }));
    mocks.household.currentHousehold = { id: 'other', currency: 'EUR', timezone: 'Europe/Madrid' };
    mocks.calendar.mockResolvedValue(calendar([]));
    refresh();
    await screen.findByRole('heading', { name: 'No hay pagos programados' });
    client.removeQueries({ queryKey: ['purchases', 'home', 'detail', 'purchase'], exact: true });
    await act(async () => resolve(paidPurchase()));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(client.getQueryData(['purchases', 'home', 'detail', 'purchase'])).toBeUndefined();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('changing calendar range closes a purchase form and cancels its pending detail read', async () => {
    const user = userEvent.setup();
    let signal;
    mocks.detail.mockImplementation((args) => { signal = args.signal; return new Promise(() => {}); });
    setup();
    await user.click(await screen.findByRole('button', { name: 'Marcar pagado' }));
    expect(signal.aborted).toBe(false);
    await user.click(screen.getByRole('button', { name: '90 días' }));
    expect(signal.aborted).toBe(true);
    expect(screen.queryByText('Cargando datos del pago de compra')).not.toBeInTheDocument();
  });

  it('validates real payment date and uses mobile bounded inputs and accessible actions', async () => {
    const user = userEvent.setup();
    setup();
    const button = await screen.findByRole('button', { name: 'Marcar pagado' });
    expect(button).toHaveClass('min-h-11');
    button.focus();
    await user.keyboard('{Enter}');
    const date = await screen.findByLabelText('Fecha de pago');
    expect(date).toHaveClass('min-w-0', 'max-w-full');
    expect(date.closest('.date-fields-grid')).toHaveClass('min-w-0');
    fireEvent.change(date, { target: { value: '2026-10-15' } });
    await user.click(screen.getByRole('button', { name: 'Guardar pago de cuota' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no puede estar en el futuro');
    expect(mocks.pay).not.toHaveBeenCalled();
  });
});
