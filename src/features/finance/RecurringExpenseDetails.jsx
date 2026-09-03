import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarDays, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { queryKeys } from '../../api/queryKeys';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../../components/ui/FeedbackStates';
import { AuthError } from '../auth/components/AuthFeedback';
import { eurosInputToCents, formatCents, isoDate } from './money';
import { financeService } from './financeService';
import { formatCivilDate } from '../../pages/expensePageUtils';

const inputClass =
  'min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 py-2 text-base text-text outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft disabled:bg-surface-muted disabled:text-text-muted';
const primaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';

const channelLabels = Object.freeze({
  EMAIL: 'Email',
  IN_APP: 'En la aplicación',
  WEB_PUSH: 'Aviso web',
});

function centsForInput(cents) {
  return Number.isSafeInteger(cents) ? (cents / 100).toFixed(2) : '';
}

function PaymentEditor({ currency, expenseId, householdId, onClose, payment }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(payment.status);
  const [actualAmount, setActualAmount] = useState(centsForInput(payment.actualAmountCents));
  const [paymentDate, setPaymentDate] = useState(isoDate(payment.paymentDate));
  const [notes, setNotes] = useState(payment.notes ?? '');
  const [validationError, setValidationError] = useState('');
  const updatePayment = useMutation({
    mutationFn: financeService.updateRecurringPayment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.recurringExpenses.payments(householdId, expenseId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.recurringExpenses.all(householdId),
        }),
        queryClient.invalidateQueries({ queryKey: ['calendar', householdId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', householdId] }),
      ]);
      toast.success('Pago corregido.');
      onClose();
    },
  });

  function savePayment(event) {
    event.preventDefault();
    let actualAmountCents;
    try {
      if (status === 'PAID' && !paymentDate) {
        throw new Error('Indica la fecha de pago.');
      }
      actualAmountCents = status === 'PAID' ? eurosInputToCents(actualAmount) : null;
      setValidationError('');
    } catch (error) {
      setValidationError(error.message);
      return;
    }
    updatePayment.mutate({
      householdId,
      expenseId,
      paymentId: payment.id,
      body: {
        status,
        actualAmountCents,
        paymentDate: status === 'PAID' ? paymentDate : null,
        notes: notes.trim() || null,
      },
    });
  }

  return (
    <form
      aria-label={`Editar pago de ${formatCivilDate(payment.dueDate)}`}
      className="mt-4 border-t border-border pt-4"
      noValidate
      onSubmit={savePayment}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h5 className="font-extrabold text-text">Corregir pago</h5>
          <p className="mt-1 text-xs leading-5 text-text-muted">
            Cambia solo este registro histórico; el próximo vencimiento y su importe no se alteran.
          </p>
        </div>
        <button
          aria-label="Cancelar edición del pago"
          className="grid size-11 shrink-0 place-items-center rounded-xl text-text-muted hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-bold text-text">Resultado del vencimiento</legend>
        <div className="mt-2 grid gap-2 min-[430px]:grid-cols-2">
          {[
            ['PAID', 'Pagado'],
            ['SKIPPED', 'Omitido'],
          ].map(([value, label]) => (
            <label
              className="flex min-h-11 items-center gap-3 rounded-xl border border-border-strong px-3 py-2 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
              key={value}
            >
              <input
                checked={status === value}
                className="size-4 accent-brand"
                name={`payment-status-${payment.id}`}
                onChange={() => setStatus(value)}
                type="radio"
                value={value}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {status === 'PAID' ? (
        <div className="mt-4 grid gap-4 min-[430px]:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-text" htmlFor={`payment-amount-${payment.id}`}>
              Importe real ({currency === 'EUR' ? '€' : currency})
            </label>
            <input
              className={inputClass}
              id={`payment-amount-${payment.id}`}
              inputMode="decimal"
              onChange={(event) => setActualAmount(event.target.value)}
              placeholder="0,00"
              value={actualAmount}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-text" htmlFor={`payment-date-${payment.id}`}>
              Fecha de pago
            </label>
            <input
              className={inputClass}
              id={`payment-date-${payment.id}`}
              onChange={(event) => setPaymentDate(event.target.value)}
              type="date"
              value={paymentDate}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-bold text-text" htmlFor={`payment-notes-${payment.id}`}>
          Notas <span className="font-medium text-text-muted">(opcional)</span>
        </label>
        <textarea
          className={`${inputClass} min-h-24 resize-y`}
          id={`payment-notes-${payment.id}`}
          maxLength="2000"
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
      </div>

      {validationError ? (
        <p className="mt-3 text-sm font-semibold text-red-700" role="alert">
          {validationError}
        </p>
      ) : null}
      <AuthError error={updatePayment.error} />
      <div className="mt-4 flex flex-col gap-2 min-[430px]:flex-row">
        <button className={primaryButton} disabled={updatePayment.isPending} type="submit">
          {updatePayment.isPending ? 'Guardando…' : 'Guardar corrección'}
        </button>
        <button className={secondaryButton} onClick={onClose} type="button">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function PaymentHistory({ currency, expenseId, householdId }) {
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const payments = useQuery({
    queryFn: () => financeService.recurringPayments({ householdId, expenseId }),
    queryKey: queryKeys.recurringExpenses.payments(householdId, expenseId),
  });

  return (
    <section aria-labelledby={`payment-history-${expenseId}`}>
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand-strong">
          <CalendarDays aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h4 className="font-extrabold text-text" id={`payment-history-${expenseId}`}>
            Histórico de vencimientos
          </h4>
          <p className="mt-0.5 text-xs text-text-muted">Importe previsto, resultado real y fechas.</p>
        </div>
      </div>
      <div className="mt-4">
        {payments.isPending ? <LoadingState label="Cargando histórico" /> : null}
        {payments.isError ? (
          <ErrorState
            description={payments.error.message}
            onRetry={payments.refetch}
            title="No se ha podido cargar el histórico"
          />
        ) : null}
        {payments.isSuccess && payments.data.length === 0 ? (
          <EmptyState
            description="Cuando registres un vencimiento, aparecerá aquí sin sobrescribir lo previsto."
            icon={CalendarDays}
            title="Todavía no hay movimientos"
          />
        ) : null}
        {payments.isSuccess && payments.data.length > 0 ? (
          <ol className="space-y-2">
            {payments.data.map((payment) => (
              <li className="rounded-xl border border-border bg-surface p-4" key={payment.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-text">Vencimiento {formatCivilDate(payment.dueDate)}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      payment.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {payment.status === 'PAID' ? 'Pagado' : 'Omitido'}
                  </span>
                </div>
                <dl className="mt-3 grid gap-3 min-[430px]:grid-cols-3">
                  <div>
                    <dt className="text-xs font-semibold text-text-soft">Previsto</dt>
                    <dd className="mt-0.5 font-extrabold text-text">
                      {formatCents(payment.expectedAmountCents, currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-text-soft">Real</dt>
                    <dd className="mt-0.5 font-extrabold text-text">
                      {payment.actualAmountCents == null
                        ? '—'
                        : formatCents(payment.actualAmountCents, currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-text-soft">Fecha de pago</dt>
                    <dd className="mt-0.5 font-semibold text-text">
                      {payment.paymentDate ? formatCivilDate(payment.paymentDate) : 'Sin pago'}
                    </dd>
                  </div>
                </dl>
                {payment.notes ? (
                  <p className="mt-3 text-sm leading-6 text-text-muted">{payment.notes}</p>
                ) : null}
                {editingPaymentId === payment.id ? (
                  <PaymentEditor
                    currency={currency}
                    expenseId={expenseId}
                    householdId={householdId}
                    key={payment.id}
                    onClose={() => setEditingPaymentId(null)}
                    payment={payment}
                  />
                ) : (
                  <button
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    onClick={() => setEditingPaymentId(payment.id)}
                    type="button"
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                    Editar pago
                  </button>
                )}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

function normalizeRule(rule) {
  return {
    channel: rule.channel,
    enabled: rule.enabled !== false,
    offsetDays: String(rule.offsetDays),
  };
}

function ReminderRulesEditor({ expense, householdId }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState([]);
  const [validationError, setValidationError] = useState('');
  const rulesQuery = useQuery({
    queryFn: () =>
      financeService.reminderRules({ householdId, expenseId: expense.id }),
    queryKey: queryKeys.recurringExpenses.reminderRules(householdId, expense.id),
  });
  const updateRules = useMutation({
    mutationFn: financeService.updateReminderRules,
    onSuccess: (rules) => {
      queryClient.setQueryData(
        queryKeys.recurringExpenses.reminderRules(householdId, expense.id),
        rules,
      );
      setDraft(rules.map(normalizeRule));
      toast.success('Reglas de aviso actualizadas.');
    },
  });

  useEffect(() => {
    if (rulesQuery.isSuccess) {
      setDraft(rulesQuery.data.map(normalizeRule));
      setValidationError('');
    }
  }, [rulesQuery.data, rulesQuery.isSuccess]);

  function changeRule(index, field, value) {
    setDraft((current) =>
      current.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [field]: value } : rule,
      ),
    );
  }

  function saveRules(event) {
    event.preventDefault();
    try {
      const rules = draft.map((rule, index) => {
        const offsetDays = Number(rule.offsetDays);
        if (!Number.isInteger(offsetDays) || offsetDays < 0 || offsetDays > 365) {
          throw new Error(`La regla ${index + 1} debe avisar entre 0 y 365 días antes.`);
        }
        return { channel: rule.channel, enabled: rule.enabled, offsetDays };
      });
      const identifiers = rules.map((rule) => `${rule.offsetDays}:${rule.channel}`);
      if (new Set(identifiers).size !== identifiers.length) {
        throw new Error('No puede haber dos reglas con los mismos días y canal.');
      }
      setValidationError('');
      updateRules.mutate({ householdId, expenseId: expense.id, rules });
    } catch (error) {
      setValidationError(error.message);
    }
  }

  return (
    <section aria-labelledby={`reminder-rules-${expense.id}`}>
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand-strong">
          <BellRing aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h4 className="font-extrabold text-text" id={`reminder-rules-${expense.id}`}>
            Reglas de aviso
          </h4>
          <p className="mt-0.5 text-xs text-text-muted">Configuración personal para este gasto.</p>
        </div>
      </div>
      {!expense.remindersEnabled ? (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          Los recordatorios de este gasto están desactivados. Puedes preparar las reglas, pero no
          se enviarán hasta activarlos al editar el gasto.
        </p>
      ) : null}
      <div className="mt-4">
        {rulesQuery.isPending ? <LoadingState label="Cargando reglas de aviso" /> : null}
        {rulesQuery.isError ? (
          <ErrorState
            description={rulesQuery.error.message}
            onRetry={rulesQuery.refetch}
            title="No se han podido cargar las reglas"
          />
        ) : null}
        {rulesQuery.isSuccess ? (
          <form onSubmit={saveRules}>
            {draft.length === 0 ? (
              <p className="rounded-xl bg-surface p-4 text-sm leading-6 text-text-muted">
                No hay reglas personalizadas. Los avisos generales del usuario siguen aplicándose.
              </p>
            ) : (
              <ol className="space-y-3">
                {draft.map((rule, index) => (
                  <li
                    className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                    key={`${index}-${rule.channel}`}
                  >
                    <div>
                      <label
                        className="mb-1.5 block text-sm font-bold text-text"
                        htmlFor={`rule-offset-${expense.id}-${index}`}
                      >
                        Días de antelación
                      </label>
                      <input
                        className={inputClass}
                        id={`rule-offset-${expense.id}-${index}`}
                        inputMode="numeric"
                        max="365"
                        min="0"
                        onChange={(event) => changeRule(index, 'offsetDays', event.target.value)}
                        type="number"
                        value={rule.offsetDays}
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1.5 block text-sm font-bold text-text"
                        htmlFor={`rule-channel-${expense.id}-${index}`}
                      >
                        Canal
                      </label>
                      <select
                        className={inputClass}
                        id={`rule-channel-${expense.id}-${index}`}
                        onChange={(event) => changeRule(index, 'channel', event.target.value)}
                        value={rule.channel}
                      >
                        {Object.entries(channelLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 sm:pb-0">
                      <label className="flex min-h-11 cursor-pointer items-center gap-2 px-1 text-sm font-bold text-text">
                        <input
                          checked={rule.enabled}
                          className="size-5 rounded accent-brand"
                          onChange={(event) => changeRule(index, 'enabled', event.target.checked)}
                          type="checkbox"
                        />
                        Activa
                      </label>
                      <button
                        aria-label={`Eliminar regla ${index + 1}`}
                        className="grid size-11 place-items-center rounded-xl text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        onClick={() =>
                          setDraft((current) =>
                            current.filter((_, ruleIndex) => ruleIndex !== index),
                          )
                        }
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-4 flex flex-col gap-2 min-[430px]:flex-row">
              <button
                className={secondaryButton}
                disabled={draft.length >= 60}
                onClick={() =>
                  setDraft((current) => [
                    ...current,
                    { channel: 'IN_APP', enabled: true, offsetDays: '7' },
                  ])
                }
                type="button"
              >
                <Plus aria-hidden="true" className="size-4" />
                Añadir regla
              </button>
              <button className={primaryButton} disabled={updateRules.isPending} type="submit">
                {updateRules.isPending ? 'Guardando reglas…' : 'Guardar reglas'}
              </button>
            </div>
            {validationError ? (
              <p className="mt-3 text-sm font-semibold text-red-700" role="alert">
                {validationError}
              </p>
            ) : null}
            <div className="mt-3">
              <AuthError error={updateRules.error} />
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}

export function RecurringExpenseDetails({ currency, expense, householdId }) {
  return (
    <div className="mt-5 grid gap-7 border-t border-border pt-5 lg:grid-cols-2">
      <PaymentHistory currency={currency} expenseId={expense.id} householdId={householdId} />
      <ReminderRulesEditor expense={expense} householdId={householdId} />
    </div>
  );
}
