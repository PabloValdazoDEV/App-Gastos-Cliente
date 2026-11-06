import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, Check } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import { formatCivilDate, todayIso } from '../../../pages/expensePageUtils';
import { financeService } from '../financeService';
import { invalidateBudgetQueries } from '../invalidateBudgetQueries';
import { formatCents } from '../money';
import { daysBetween, dueLabel, viewerContribution } from '../homeSummary';

const secondaryLink = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong px-4 py-2 text-sm font-bold text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export function ContributionCard({ data, month, monthLabel }) {
  const contribution = viewerContribution(data);
  if (!contribution) return null;
  const currency = data.household.currency;
  const pending = contribution.pendingCents;

  return (
    <section aria-labelledby="my-contribution-heading" className="min-w-0 rounded-2xl border border-brand/30 bg-brand-soft p-5">
      <h2 className="text-sm font-bold text-brand-strong" id="my-contribution-heading">Tu aportación de {monthLabel}</h2>
      <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{formatCents(contribution.totalCents, currency)}</p>
      <p className="mt-1 text-sm leading-6 text-text-muted">
        {contribution.prepared
          ? pending > 0
            ? `Te queda por ingresar ${formatCents(pending, currency)}.`
            : 'Ya está todo ingresado. ¡Listo este mes!'
          : 'Estimación con los gastos de hoy. Se fija al preparar el mes.'}
      </p>
      <Link className={`mt-3 ${secondaryLink} bg-surface`} to={`/planificacion?mes=${month}`}>
        {contribution.prepared ? 'Ver detalle' : 'Preparar el mes'}
      </Link>
    </section>
  );
}

function payBody(payment, today) {
  return {
    status: 'PAID',
    actualAmountCents: payment.amountCents,
    paymentDate: today,
    notes: null,
    dueDate: payment.dueDate.slice(0, 10),
    expectedAmountCents: payment.amountCents,
    nextAmountDecision: 'KEEP_PREVIOUS',
    nextExpectedAmountCents: null,
  };
}

function DuePaymentRow({ currency, householdId, payment, today }) {
  const queryClient = useQueryClient();
  const [paid, setPaid] = useState(false);
  const recurring = payment.sourceType === 'RECURRING_EXPENSE';
  const overdue = daysBetween(today, payment.dueDate) < 0;
  const pay = useMutation({
    mutationFn: () => financeService.registerPayment({
      householdId,
      expenseId: payment.expenseId,
      body: payBody(payment, today),
    }),
    onSuccess: async () => {
      setPaid(true);
      toast.success(`${payment.name}: pagado ${formatCents(payment.amountCents, currency)} hoy.`);
      await invalidateBudgetQueries(queryClient, householdId);
    },
    onError: (error) => toast.error(error.message || 'No se pudo marcar como pagado.'),
  });

  return (
    <li className="flex min-w-0 flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="break-words font-bold">{payment.name}</p>
        <p className={`text-sm ${overdue ? 'font-semibold text-red-700' : 'text-text-muted'}`}>
          {overdue ? <AlertTriangle aria-hidden="true" className="mr-1 inline size-4 align-[-3px]" /> : null}
          {dueLabel(payment.dueDate, today)} · {formatCivilDate(payment.dueDate)}
        </p>
      </div>
      <p className="font-extrabold tabular-nums">{formatCents(payment.amountCents, currency)}</p>
      {paid ? (
        <span className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-brand-strong" role="status">
          <Check aria-hidden="true" className="size-4" />Pagado
        </span>
      ) : recurring ? (
        <div className="flex flex-wrap gap-2">
          <button
            aria-label={`Marcar ${payment.name} como pagado hoy por ${formatCents(payment.amountCents, currency)}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            disabled={pay.isPending}
            onClick={() => pay.mutate()}
            type="button"
          >
            <Check aria-hidden="true" className="size-4" />{pay.isPending ? 'Guardando…' : 'Pagado'}
          </button>
          <Link
            aria-label={`Pagar ${payment.name} con otro importe o fecha`}
            className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-brand-strong underline-offset-2 hover:underline"
            to={`/gastos/recurrentes/${payment.expenseId}`}
          >
            Otro importe
          </Link>
        </div>
      ) : payment.purchaseId ? (
        <Link className={secondaryLink} to={`/compras/${payment.purchaseId}`}>Ver cuota</Link>
      ) : null}
    </li>
  );
}

export function DuePaymentsCard({ data, householdId }) {
  const today = (data.calculationDate || todayIso()).slice(0, 10);
  const due = (data.upcomingPayments ?? []).filter((payment) => daysBetween(today, payment.dueDate) <= 0);
  const soon = (data.upcomingPayments ?? []).filter((payment) => daysBetween(today, payment.dueDate) > 0);
  const currency = data.household.currency;

  return (
    <section aria-labelledby="due-payments-heading" className="min-w-0 rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold" id="due-payments-heading">
        <CalendarClock aria-hidden="true" className="size-5 text-brand-strong" />Pagos de hoy y atrasados
      </h2>
      {due.length ? (
        <ul className="mt-1 divide-y divide-border">
          {due.map((payment) => (
            <DuePaymentRow
              currency={currency}
              householdId={householdId}
              key={`${payment.sourceType}:${payment.expenseId ?? payment.id ?? payment.name}:${payment.dueDate}`}
              payment={payment}
              today={today}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-text-muted">No tienes nada pendiente para hoy.</p>
      )}
      {soon.length ? (
        <p className="mt-2 text-sm text-text-muted">
          Próximos días: {soon.map((payment) => `${payment.name} (${dueLabel(payment.dueDate, today).toLowerCase()})`).join(' · ')}.{' '}
          <Link className="font-semibold text-brand-strong underline" to="/calendario">Ver calendario</Link>
        </p>
      ) : null}
    </section>
  );
}
