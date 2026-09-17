import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

import { TextareaField } from '../../pages/expensePageShared';
import { AuthError, SubmitButton } from '../auth/components/AuthFeedback';
import { FormField } from '../auth/components/FormField';
import { formatCents } from '../finance/money';
import { purchaseDateLabel } from './presentation';
import { focusPurchaseFormError } from './purchaseFormState';
import { purchaseInstallmentDefaults, purchaseInstallmentFormSchema, purchaseInstallmentPayload, purchasePaymentToday } from './purchaseInstallmentFormState';

export function PurchaseInstallmentForm({ installment, currency = 'EUR', timezone, isPending, error, onSubmit, onCancel }) {
  const formRef = useRef(null);
  const lockRef = useRef(false);
  const today = purchasePaymentToday(timezone);
  const editing = installment.status === 'PAID';
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: purchaseInstallmentDefaults(installment, today),
    resolver: zodResolver(purchaseInstallmentFormSchema(today)),
    shouldFocusError: false,
  });
  const pending = Boolean(isPending || isSubmitting);
  useEffect(() => { formRef.current?.querySelector('input')?.focus(); }, []);
  const submit = handleSubmit(async (values) => {
    if (lockRef.current || pending) return;
    lockRef.current = true;
    try { await onSubmit(purchaseInstallmentPayload(values)); }
    catch { /* Keep entered values; the panel owns the normalized error. */ }
    finally { lockRef.current = false; }
  }, () => requestAnimationFrame(() => focusPurchaseFormError(formRef.current)));

  return <form aria-busy={pending} aria-label={`${editing ? 'Editar pago' : 'Pagar'} de cuota ${installment.sequence}`} className="min-w-0 space-y-5 rounded-2xl border border-border bg-surface-muted p-4 sm:p-5" noValidate onSubmit={submit} ref={formRef}>
    <h3 className="text-lg font-extrabold">{editing ? 'Editar pago' : 'Registrar pago'} · cuota {installment.sequence}</h3>
    <p className="text-sm leading-6 text-text-muted">Previsto: {formatCents(installment.expectedAmountCents, currency)} · vencimiento {purchaseDateLabel(installment.dueDate)}. Puedes registrar un pago anticipado.</p>
    <div className="date-fields-grid grid min-w-0 gap-5">
      <FormField disabled={pending} error={errors.amount?.message} inputMode="decimal" label={`Importe real (${currency === 'EUR' ? '€' : currency})`} {...register('amount')} />
      <FormField disabled={pending} error={errors.paidAt?.message} label="Fecha de pago" max={today} type="date" {...register('paidAt')} />
    </div>
    <TextareaField disabled={pending} error={errors.notes?.message} label="Notas del pago (opcional)" maxLength={2000} {...register('notes')} />
    <p className="text-sm leading-6 text-text-muted">El importe real sumará gasto utilizado en el mes de esta fecha de pago. La cuota prevista permanece en el presupuesto de su vencimiento, aunque pagues antes. Los saldos no se modifican automáticamente.</p>
    <AuthError error={error} />
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
      <div className="min-w-0 sm:flex-1"><SubmitButton isPending={pending} pendingLabel="Guardando pago…">{editing ? 'Guardar corrección del pago' : 'Guardar pago de cuota'}</SubmitButton></div>
      <button className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-bold hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60" disabled={pending} onClick={onCancel} type="button">Cancelar</button>
    </div>
  </form>;
}
