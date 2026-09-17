import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { TextareaField } from '../../pages/expensePageShared';
import { formatCivilDate } from '../../pages/expensePageUtils';
import { AuthError, SubmitButton } from '../auth/components/AuthFeedback';
import { FormField } from '../auth/components/FormField';
import { financeService } from './financeService';
import { formatCents } from './money';
import {
  invalidatePaymentQueries,
  paymentConflictMessage,
  paymentOccurrenceDefaults,
  paymentOccurrencePayload,
  paymentOccurrenceSchema,
} from './paymentOccurrence';

export function PaymentOccurrenceForm({
  currency = 'EUR',
  dueDate,
  expense,
  householdId,
  id,
  initialStatus = 'PAID',
  onClose,
  payment = null,
}) {
  const queryClient = useQueryClient();
  const formRef = useRef(null);
  const isEditing = Boolean(payment);
  const occurrenceDate = payment?.dueDate ?? dueDate ?? expense.nextDueDate;
  const expectedAmountCents = payment?.expectedAmountCents ?? expense.amountCents;
  const savePayment = useMutation({
    mutationFn: isEditing ? financeService.updateRecurringPayment : financeService.registerPayment,
    onSuccess: async (_, variables) => {
      await invalidatePaymentQueries(queryClient, householdId, expense.id);
      toast.success(isEditing ? 'Registro actualizado.' : variables.body.status === 'PAID'
        ? 'Pago registrado.' : 'Vencimiento omitido.');
      onClose();
    },
    onError: async (error) => {
      const message = paymentConflictMessage(error);
      if (!message) return;
      toast.error(message);
      await invalidatePaymentQueries(queryClient, householdId, expense.id);
      onClose();
    },
  });
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm({
    defaultValues: paymentOccurrenceDefaults({ expense, payment, initialStatus }),
    resolver: zodResolver(paymentOccurrenceSchema),
  });
  const status = watch('status');
  const statusRegistration = register('status', {
    onChange: (event) => {
      if (event.target.value === 'SKIPPED') {
        setValue('updateNextAmount', false, { shouldDirty: true, shouldValidate: true });
      }
    },
  });

  useEffect(() => {
    formRef.current?.querySelector('input:checked')?.focus();
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    // Prevent Enter/double-tap while the request and its refresh are pending.
    if (savePayment.isPending) return;
    try {
      await savePayment.mutateAsync({
        householdId,
        expenseId: expense.id,
        ...(payment ? { paymentId: payment.id } : {}),
        body: paymentOccurrencePayload(values, { expense, dueDate, payment }),
      });
    } catch {
      // Normalized field-independent failures stay visible; conflicts refresh
      // and close the stale form through the mutation's shared error handler.
    }
  });

  return (
    <form
      aria-busy={savePayment.isPending}
      aria-label={isEditing ? `Editar pago de ${formatCivilDate(occurrenceDate)}` : `Registrar pago de ${expense.name}`}
      className="mt-5 min-w-0 max-w-full border-t border-border pt-5"
      id={id}
      noValidate
      onSubmit={onSubmit}
      ref={formRef}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="break-words font-extrabold text-text">{isEditing ? 'Corregir pago' : 'Registrar vencimiento'}</h4>
          <p className="mt-1 break-words text-sm text-text-muted">
            Previsto: {formatCents(expectedAmountCents, currency)} · {formatCivilDate(occurrenceDate)}
          </p>
          {isEditing ? (
            <p className="mt-2 text-xs leading-5 text-text-muted">
              Cambia solo este registro histórico; el próximo vencimiento y su importe no se alteran.
            </p>
          ) : null}
        </div>
        <button
          aria-label={isEditing ? 'Cancelar edición del pago' : 'Cancelar registro de pago'}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-text-muted hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
          disabled={savePayment.isPending}
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      <fieldset className="mt-5 min-w-0" disabled={savePayment.isPending}>
        <legend className="text-sm font-bold text-text">Resultado del vencimiento</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            ['PAID', 'Pagado'],
            ['SKIPPED', 'Omitido'],
          ].map(([value, label]) => (
            <label
              className="flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-border-strong px-3 py-2.5 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
              key={value}
            >
              <input className="size-4 shrink-0 accent-brand" type="radio" value={value} {...statusRegistration} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {status === 'PAID' ? (
        <div className="date-fields-grid mt-5 grid min-w-0 gap-5">
          <FormField
            disabled={savePayment.isPending}
            error={errors.actualAmount?.message}
            inputMode="decimal"
            label={`Importe real (${currency === 'EUR' ? '€' : currency})`}
            placeholder="0,00"
            {...register('actualAmount')}
          />
          <FormField
            disabled={savePayment.isPending}
            error={errors.paymentDate?.message}
            label="Fecha de pago"
            type="date"
            {...register('paymentDate')}
          />
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-surface-muted p-3 text-sm leading-6 text-text-muted">
          {isEditing
            ? 'Al guardar, este registro quedará omitido, sin importe real ni fecha de pago. El próximo vencimiento no cambiará.'
            : 'Confirma que quieres omitir este vencimiento. No se registrará ningún pago y se avanzará al siguiente vencimiento.'}
        </p>
      )}

      {status === 'PAID' && !isEditing ? (
        <label className="mt-5 flex min-h-11 items-start gap-3 rounded-xl bg-surface-muted px-3.5 py-3 text-sm text-text">
          <input className="mt-0.5 size-4 shrink-0 accent-brand" disabled={savePayment.isPending} type="checkbox" {...register('updateNextAmount')} />
          <span className="min-w-0">
            <span className="block font-bold">Usar el importe real en el próximo vencimiento</span>
            <span className="mt-0.5 block text-xs leading-5 text-text-muted">
              El histórico conservará por separado el importe que se esperaba y el que se pagó.
            </span>
          </span>
        </label>
      ) : null}

      <div className="mt-5 min-w-0">
        <TextareaField
          disabled={savePayment.isPending}
          error={errors.notes?.message}
          label="Notas (opcional)"
          maxLength={2_000}
          {...register('notes')}
        />
      </div>
      <div className="mt-5 space-y-3">
        <AuthError error={savePayment.error} />
        <SubmitButton isPending={savePayment.isPending} pendingLabel="Guardando registro…">
          {isEditing ? 'Guardar corrección' : status === 'SKIPPED' ? 'Confirmar omisión' : 'Guardar pago'}
        </SubmitButton>
        <button
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border-strong px-4 py-2.5 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
          disabled={savePayment.isPending}
          onClick={onClose}
          type="button"
        >Cancelar</button>
      </div>
    </form>
  );
}
