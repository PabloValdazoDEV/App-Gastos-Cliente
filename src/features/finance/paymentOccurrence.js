import { z } from 'zod';

import { queryKeys } from '../../api/queryKeys';
import { positiveMoneyInputSchema, todayIso } from '../../pages/expensePageUtils';
import { invalidateBudgetQueries } from './invalidateBudgetQueries';
import { eurosInputToCents, isoDate } from './money';

// Creation and historical corrections deliberately share the same validation.
export const paymentOccurrenceSchema = z.object({
  status: z.enum(['PAID', 'SKIPPED']),
  actualAmount: z.string().optional(),
  paymentDate: z.string().optional(),
  updateNextAmount: z.boolean(),
  notes: z.string().trim().max(2_000, 'Las notas son demasiado largas.').optional(),
}).superRefine((values, context) => {
  if (values.status !== 'PAID') return;
  const amount = positiveMoneyInputSchema.safeParse(values.actualAmount ?? '');
  if (!amount.success) {
    context.addIssue({ code: 'custom', message: amount.error.issues[0].message, path: ['actualAmount'] });
  }
  if (!z.iso.date().safeParse(values.paymentDate).success) {
    context.addIssue({ code: 'custom', message: 'Indica una fecha de pago válida.', path: ['paymentDate'] });
  }
});

export function paymentOccurrenceDefaults({ expense, payment, initialStatus = 'PAID' }) {
  const amount = payment?.actualAmountCents ?? payment?.expectedAmountCents ?? expense.amountCents;
  return {
    status: payment?.status ?? initialStatus,
    actualAmount: Number.isSafeInteger(amount) ? (amount / 100).toFixed(2) : '',
    paymentDate: isoDate(payment?.paymentDate) || todayIso(),
    notes: payment?.notes ?? '',
    updateNextAmount: false,
  };
}

export function paymentOccurrencePayload(values, { expense, dueDate, payment }) {
  const isPaid = values.status === 'PAID';
  const actualAmountCents = isPaid ? eurosInputToCents(values.actualAmount) : null;
  const body = {
    status: values.status,
    actualAmountCents,
    paymentDate: isPaid ? values.paymentDate : null,
    notes: values.notes?.trim() || null,
  };
  // PATCH must never carry recurrence/future-amount decisions, even if a stale
  // checked value survives in memory when changing state.
  if (payment) return body;
  const updateNextAmount = isPaid && values.updateNextAmount;
  return {
    ...body,
    dueDate: isoDate(dueDate ?? expense.nextDueDate),
    expectedAmountCents: expense.amountCents,
    nextAmountDecision: updateNextAmount ? 'UPDATE_NEXT_AMOUNT' : 'KEEP_PREVIOUS',
    nextExpectedAmountCents: updateNextAmount ? actualAmountCents : null,
  };
}

export function invalidatePaymentQueries(queryClient, householdId, expenseId) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['calendar', householdId] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.recurringExpenses.all(householdId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.recurringExpenses.payments(householdId, expenseId) }),
    // Also refresh planning after any advance; the recurrence horizon changes
    // even when the expected amount stays the same.
    invalidateBudgetQueries(queryClient, householdId),
  ]);
}

export function paymentConflictMessage(error) {
  if (error?.code === 'PAYMENT_ALREADY_REGISTERED') {
    return 'Este vencimiento ya se ha registrado. Hemos actualizado los datos.';
  }
  if (error?.code === 'PAYMENT_NOT_CURRENT_OCCURRENCE') {
    return 'Primero registra el vencimiento pendiente anterior. Hemos actualizado los datos.';
  }
  return null;
}
