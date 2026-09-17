import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ registerPayment: vi.fn(), updateRecurringPayment: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('./financeService', () => ({ financeService: mocks }));
vi.mock('react-hot-toast', () => ({ default: { success: mocks.success, error: mocks.error } }));

import { todayIso } from '../../pages/expensePageUtils';
import { PaymentOccurrenceForm } from './PaymentOccurrenceForm';
import { paymentOccurrencePayload, paymentOccurrenceSchema } from './paymentOccurrence';

const expense = { id: 'expense-1', name: 'Gimnasio', amountCents: 4_000, nextDueDate: '2026-10-15' };
const payment = {
  id: 'payment-1', status: 'PAID', dueDate: '2026-09-17', expectedAmountCents: 4_000,
  actualAmountCents: 4_200, paymentDate: '2026-09-19', notes: 'Pago inicial',
};

function renderForm(props = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const onClose = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <PaymentOccurrenceForm currency="EUR" expense={expense} householdId="household-1" onClose={onClose} {...props} />
    </QueryClientProvider>,
  );
  return { ...view, client, invalidate, onClose };
}

describe('PaymentOccurrenceForm shared creation and historical correction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.registerPayment.mockResolvedValue({ payment: { id: 'created-payment' } });
    mocks.updateRecurringPayment.mockResolvedValue(payment);
  });

  it('defaults to expected amount and today, focuses the selected state and preserves responsive date controls', () => {
    renderForm();
    expect(screen.getByLabelText('Importe real (€)')).toHaveValue('40.00');
    const date = screen.getByLabelText('Fecha de pago');
    expect(date).toHaveValue(todayIso());
    expect(date).toHaveClass('min-w-0', 'max-w-full');
    expect(date.parentElement.parentElement).toHaveClass('date-fields-grid', 'min-w-0');
    expect(screen.getByRole('radio', { name: 'Pagado' })).toHaveFocus();
    expect(screen.getByRole('form')).toHaveClass('min-w-0', 'max-w-full');
  });

  it('registers PAID with explicit due date, real amount, actual date and notes', async () => {
    const user = userEvent.setup();
    const { onClose } = renderForm({ dueDate: '2026-09-10' });
    await user.clear(screen.getByLabelText('Importe real (€)'));
    await user.type(screen.getByLabelText('Importe real (€)'), '42,50');
    fireEvent.change(screen.getByLabelText('Fecha de pago'), { target: { value: '2026-09-17' } });
    await user.type(screen.getByLabelText('Notas (opcional)'), '  Pagado tarde  ');
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(mocks.registerPayment).toHaveBeenCalledWith({
      householdId: 'household-1', expenseId: 'expense-1',
      body: { status: 'PAID', actualAmountCents: 4_250, paymentDate: '2026-09-17', notes: 'Pagado tarde', dueDate: '2026-09-10', expectedAmountCents: 4_000, nextAmountDecision: 'KEEP_PREVIOUS', nextExpectedAmountCents: null },
    });
    expect(mocks.success).toHaveBeenCalledWith('Pago registrado.');
  });

  it('uses UPDATE_NEXT_AMOUNT only when opted into a new paid occurrence and invalidates every financial prefix', async () => {
    const user = userEvent.setup();
    const { invalidate, onClose } = renderForm();
    await user.clear(screen.getByLabelText('Importe real (€)'));
    await user.type(screen.getByLabelText('Importe real (€)'), '42');
    await user.click(screen.getByRole('checkbox', { name: /Usar el importe real/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.registerPayment).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ nextAmountDecision: 'UPDATE_NEXT_AMOUNT', nextExpectedAmountCents: 4_200 }) }));
    for (const prefix of ['calendar', 'recurringExpenses', 'dashboard', 'budget', 'simulation', 'plannings', 'monthlyPlanning']) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [prefix, 'household-1'] });
    }
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['recurringExpenses', 'household-1', 'payments', 'expense-1'] });
  });

  it('opening SKIPPED is a confirmation panel, never a mutation, and submits clean null payment fields', async () => {
    const user = userEvent.setup();
    const { onClose } = renderForm({ initialStatus: 'SKIPPED' });
    expect(screen.getByRole('radio', { name: 'Omitido' })).toHaveFocus();
    expect(screen.getByText(/Confirma que quieres omitir/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Importe real (€)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fecha de pago')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(mocks.registerPayment).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Notas (opcional)'), 'Vacaciones');
    await user.click(screen.getByRole('button', { name: 'Confirmar omisión' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.registerPayment).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ status: 'SKIPPED', actualAmountCents: null, paymentDate: null, notes: 'Vacaciones', nextAmountDecision: 'KEEP_PREVIOUS', nextExpectedAmountCents: null }) }));
    expect(mocks.success).toHaveBeenCalledWith('Vencimiento omitido.');
  });

  it('cancel never submits', async () => {
    const user = userEvent.setup();
    const { onClose } = renderForm({ initialStatus: 'SKIPPED' });
    await user.click(screen.getByRole('button', { name: 'Cancelar', exact: true }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(mocks.registerPayment).not.toHaveBeenCalled();
  });

  it('edits historical PAID using the same form without exposing future amount options', async () => {
    const user = userEvent.setup();
    const { onClose } = renderForm({ payment });
    expect(screen.getByLabelText('Importe real (€)')).toHaveValue('42.00');
    expect(screen.getByLabelText('Fecha de pago')).toHaveValue('2026-09-19');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Cambia solo este registro histórico/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Importe real (€)'));
    await user.type(screen.getByLabelText('Importe real (€)'), '41,20');
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.updateRecurringPayment).toHaveBeenCalledWith({ householdId: 'household-1', expenseId: 'expense-1', paymentId: 'payment-1', body: { status: 'PAID', actualAmountCents: 4_120, paymentDate: '2026-09-19', notes: 'Pago inicial' } });
    expect(mocks.registerPayment).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith('Registro actualizado.');
  });

  it('corrects PAID to SKIPPED with no amount, date or recurrence fields', async () => {
    const user = userEvent.setup();
    renderForm({ payment });
    await user.click(screen.getByRole('radio', { name: 'Omitido' }));
    expect(mocks.updateRecurringPayment).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }));
    await waitFor(() => expect(mocks.updateRecurringPayment).toHaveBeenCalledWith({ householdId: 'household-1', expenseId: 'expense-1', paymentId: 'payment-1', body: { status: 'SKIPPED', actualAmountCents: null, paymentDate: null, notes: 'Pago inicial' } }));
  });

  it('corrects SKIPPED to PAID and requires positive amount and valid payment date with associated field errors', async () => {
    const user = userEvent.setup();
    renderForm({ payment: { ...payment, status: 'SKIPPED', actualAmountCents: null, paymentDate: null } });
    await user.click(screen.getByRole('radio', { name: 'Pagado' }));
    await user.clear(screen.getByLabelText('Importe real (€)'));
    fireEvent.change(screen.getByLabelText('Fecha de pago'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }));
    expect(screen.getByLabelText('Importe real (€)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Fecha de pago')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Fecha de pago')).toHaveAccessibleDescription('Indica una fecha de pago válida.');
    expect(mocks.updateRecurringPayment).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Importe real (€)'), '40');
    fireEvent.change(screen.getByLabelText('Fecha de pago'), { target: { value: '2026-09-20' } });
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }));
    await waitFor(() => expect(mocks.updateRecurringPayment).toHaveBeenCalledWith(expect.objectContaining({ body: { status: 'PAID', actualAmountCents: 4_000, paymentDate: '2026-09-20', notes: 'Pago inicial' } })));
  });

  it.each(['PAYMENT_ALREADY_REGISTERED', 'PAYMENT_NOT_CURRENT_OCCURRENCE'])('refreshes and closes stale form on %s', async (code) => {
    const user = userEvent.setup();
    mocks.registerPayment.mockRejectedValueOnce(Object.assign(new Error('Conflicto'), { code }));
    const { invalidate, onClose } = renderForm();
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['calendar', 'household-1'] });
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining(code === 'PAYMENT_ALREADY_REGISTERED' ? 'ya se ha registrado' : 'vencimiento pendiente anterior'));
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('keeps retryable errors visible without closing or claiming success', async () => {
    const user = userEvent.setup();
    mocks.registerPayment.mockRejectedValueOnce(new Error('No hay conexión. Inténtalo de nuevo.'));
    const { onClose } = renderForm();
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión. Inténtalo de nuevo.');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Guardar pago' })).toBeEnabled();
  });

  it('disables double submissions and shows the pending state', async () => {
    const user = userEvent.setup();
    let resolve;
    mocks.registerPayment.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { onClose } = renderForm();
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }));
    expect(screen.getByRole('button', { name: 'Guardando registro…' })).toBeDisabled();
    expect(screen.getByRole('form')).toHaveAttribute('aria-busy', 'true');
    await user.click(screen.getByRole('button', { name: 'Guardando registro…' }));
    expect(mocks.registerPayment).toHaveBeenCalledOnce();
    resolve({ payment });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});

describe('single occurrence schema and payload', () => {
  it.each(['', '0', '-5', '1.234', 'abc'])('rejects invalid paid amount %j for both modes', (actualAmount) => {
    expect(paymentOccurrenceSchema.safeParse({ status: 'PAID', actualAmount, paymentDate: '2026-09-17', updateNextAmount: false }).success).toBe(false);
  });

  it('never leaks future decisions into historical correction or skipped creation', () => {
    const values = { status: 'SKIPPED', actualAmount: '42', paymentDate: '2026-09-17', updateNextAmount: true, notes: '' };
    expect(paymentOccurrencePayload(values, { expense, payment })).toEqual({ status: 'SKIPPED', actualAmountCents: null, paymentDate: null, notes: null });
    expect(paymentOccurrencePayload(values, { expense })).toMatchObject({ nextAmountDecision: 'KEEP_PREVIOUS', nextExpectedAmountCents: null });
    expect(paymentOccurrencePayload({ ...values, status: 'PAID' }, { expense, payment })).toEqual({ status: 'PAID', actualAmountCents: 4_200, paymentDate: '2026-09-17', notes: null });
  });
});
