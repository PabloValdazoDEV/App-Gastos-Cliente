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

export function ContributionCard({ data, month, monthLabel, nextMonth, nextMonthLabel }) {
  const contribution = viewerContribution(data);
  const currency = data.household.currency;
  const planning = data.planning;
  const nextLink = nextMonth ? (
    <Link className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand-strong underline-offset-2 hover:underline" to={`/planificacion?mes=${nextMonth}`}>
      Preparar {nextMonthLabel}
    </Link>
  ) : null;

  const extrasPending = planning?.extraFunding?.pendingCents > 0;
  const notices = (
    <>
      {extrasPending ? <p className="mt-1 text-sm font-semibold" role="status">Hay aportaciones extra pendientes de ingresar.</p> : null}
      {planning?.budgetChangedSincePreparation ? <p className="mt-1 text-sm text-text-muted" role="status">Los gastos han cambiado desde que lo preparaste; revisa las diferencias en Planificación.</p> : null}
    </>
  );

  if (!contribution) {
    return (
      <section aria-labelledby="my-contribution-heading" className="min-w-0 rounded-2xl border border-brand/30 bg-brand-soft p-5">
        <h2 className="text-sm font-bold text-brand-strong" id="my-contribution-heading">Aportaciones de {monthLabel}</h2>
        <p className="mt-1 text-sm leading-6 text-text-muted">Se calculan en Planificación.</p>
        {notices}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link className={`${secondaryLink} bg-surface`} to={`/planificacion?mes=${month}`}>{planning ? 'Ver aportaciones' : 'Preparar el mes'}</Link>
          {nextLink}
        </div>
      </section>
    );
  }
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
      {notices}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link className={`${secondaryLink} bg-surface`} to={`/planificacion?mes=${month}`}>
          {contribution.prepared ? 'Ver detalle' : 'Preparar el mes'}
        </Link>
        {nextLink}
      </div>
    </section>
  );
}

function payBody(payment, dueDate, today) {
  return {
    status: 'PAID',
    actualAmountCents: payment.amountCents,
    paymentDate: today,
    notes: null,
    dueDate: dueDate.slice(0, 10),
    expectedAmountCents: payment.amountCents,
    nextAmountDecision: 'KEEP_PREVIOUS',
    nextExpectedAmountCents: null,
  };
}

const primaryButton = 'inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const textButton = 'inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-brand-strong underline-offset-2 hover:underline disabled:opacity-60';

function DuePaymentRow({ currency, householdId, payment, today }) {
  const queryClient = useQueryClient();
  const [paid, setPaid] = useState(false);
  const recurring = payment.sourceType === 'RECURRING_EXPENSE';
  const overdue = daysBetween(today, payment.dueDate) < 0;
  // Several unpaid months of the same expense are shown as one row.
  const pendingDates = recurring && payment.pendingDueDates?.length ? payment.pendingDueDates : [payment.dueDate];
  const count = pendingDates.length;
  const pay = useMutation({
    // The server only accepts the oldest unpaid occurrence, so pay them in order.
    mutationFn: async (dates) => {
      for (const dueDate of dates) {
        await financeService.registerPayment({
          householdId,
          expenseId: payment.expenseId,
          body: payBody(payment, dueDate, today),
        });
      }
      return dates;
    },
    onSuccess: async (dates) => {
      setPaid(dates.length === count);
      toast.success(dates.length > 1
        ? `${payment.name}: pagados ${dates.length} vencimientos (${formatCents(payment.amountCents * dates.length, currency)}).`
        : `${payment.name}: pagado el del ${formatCivilDate(dates[0])} (${formatCents(payment.amountCents, currency)}).`);
      await invalidateBudgetQueries(queryClient, householdId);
    },
    onError: async (error) => {
      toast.error(error.message || 'No se pudo marcar como pagado.');
      await invalidateBudgetQueries(queryClient, householdId);
    },
  });

  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 py-3">
      {/* min-w keeps the name readable: on narrow screens the buttons wrap below instead of squeezing it. */}
      <div className="min-w-40 flex-1">
        <p className="break-words font-bold">{payment.name}</p>
        <p className={`text-sm ${overdue ? 'font-semibold text-red-700' : 'text-text-muted'}`}>
          {overdue ? <AlertTriangle aria-hidden="true" className="mr-1 inline size-4 align-[-3px]" /> : null}
          {count > 1
            ? `${count} vencimientos sin pagar · desde el ${formatCivilDate(payment.dueDate)}`
            : `${dueLabel(payment.dueDate, today)} · ${formatCivilDate(payment.dueDate)}`}
        </p>
      </div>
      <p className="text-right font-extrabold tabular-nums">
        {formatCents(payment.amountCents * count, currency)}
        {count > 1 ? <span className="block text-xs font-semibold text-text-muted">{count} × {formatCents(payment.amountCents, currency)}</span> : null}
      </p>
      {paid ? (
        <span className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-brand-strong" role="status">
          <Check aria-hidden="true" className="size-4" />Pagado
        </span>
      ) : recurring ? (
        <div className="flex flex-wrap gap-2">
          <button
            aria-label={count > 1
              ? `Marcar los ${count} vencimientos de ${payment.name} como pagados hoy por ${formatCents(payment.amountCents * count, currency)}`
              : `Marcar ${payment.name} como pagado hoy por ${formatCents(payment.amountCents, currency)}`}
            className={primaryButton}
            disabled={pay.isPending}
            onClick={() => pay.mutate(pendingDates)}
            type="button"
          >
            <Check aria-hidden="true" className="size-4" />
            {pay.isPending ? 'Guardando…' : count > 1 ? `Pagar los ${count}` : 'Pagado'}
          </button>
          {count > 1 ? (
            <button
              className={textButton}
              disabled={pay.isPending}
              onClick={() => pay.mutate(pendingDates.slice(0, 1))}
              type="button"
            >
              Solo el del {formatCivilDate(payment.dueDate)}
            </button>
          ) : (
            <Link
              aria-label={`Pagar ${payment.name} con otro importe o fecha`}
              className={textButton}
              to={`/gastos/recurrentes/${payment.expenseId}`}
            >
              Otro importe
            </Link>
          )}
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
