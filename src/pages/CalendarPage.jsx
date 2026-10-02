import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Clock3, List, X, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { queryKeys } from '../api/queryKeys';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { financeService } from '../features/finance/financeService';
import { invalidateBudgetQueries } from '../features/finance/invalidateBudgetQueries';
import { calendarToday, shiftCalendarMonth } from '../features/finance/calendarPeriod';
import { PaymentOccurrenceForm } from '../features/finance/PaymentOccurrenceForm';
import { formatCents } from '../features/finance/money';
import { useHousehold } from '../features/households/useHousehold';
import { CalendarPurchasePaymentForm } from '../features/purchases/CalendarPurchasePaymentForm';
import { isPurchaseFinancialSource, purchaseFinancialScopeLabel, purchaseFinancialSourceLabel } from '../features/purchases/purchaseFinancialPresentation';

const statusConfig = {
  PAID: { label: 'Pagado', icon: CircleCheck, className: 'bg-emerald-100 text-emerald-800' },
  SKIPPED: { label: 'Omitido', icon: CircleCheck, className: 'bg-surface-muted text-text-muted' },
  OVERDUE: { label: 'Atrasado', icon: TriangleAlert, className: 'bg-red-100 text-red-800' },
  DUE: { label: 'Vence hoy', icon: Clock3, className: 'bg-amber-100 text-amber-900' },
  UPCOMING: { label: 'Próximo', icon: Clock3, className: 'bg-brand-soft text-brand-strong' },
  RECORDED: { label: 'Sin pago confirmado', icon: Clock3, className: 'bg-surface-muted text-text-muted' },
  UNCONFIRMED: { label: 'Sin pago confirmado', icon: Clock3, className: 'bg-surface-muted text-text-muted' },
};

const sourceDetails = {
  INVOICE: { label: 'Factura', to: '/facturas', link: 'Ver facturas' },
  VARIABLE_EXPENSE: { label: 'Gasto variable', to: '/gastos/variables', link: 'Ver gastos variables' },
  VARIABLE_SUMMARY: { label: 'Total mensual variable', to: '/gastos/variables', link: 'Ver gastos variables' },
  ONE_TIME_EXPENSE: { label: 'Gasto puntual', to: '/gastos/puntuales', link: 'Ver gastos puntuales' },
};

function formatDate(date, monthly = false) {
  return new Intl.DateTimeFormat('es-ES', {
    day: monthly ? undefined : 'numeric',
    month: monthly ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

function calendarDays(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const mondayFirstOffset = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 1, 1 - mondayFirstOffset + index));
    return { date: date.toISOString().slice(0, 10), belongsToMonth: date.getUTCMonth() === monthNumber - 1 };
  });
}

function eventAmount(event) {
  if (event.status === 'SKIPPED') return 0;
  return event.status === 'PAID' ? event.actualAmountCents ?? 0 : event.expectedAmountCents ?? event.amountCents ?? 0;
}

function compactMoney(cents, currency) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 })
    .format(cents / 100);
}

function sortedEvents(events) {
  return [...events].sort((left, right) => left.dueDate.localeCompare(right.dueDate)
    || left.name.localeCompare(right.name, 'es'));
}

function DayCalendar({ days, eventsByDate, currentMonth, currency, onSelect, selectedDate, today, buttonRefs }) {
  return <section aria-labelledby="month-calendar-heading" className="min-w-0">
    <h3 className="sr-only" id="month-calendar-heading">Calendario de gastos de {formatDate(`${currentMonth}-01`, true)}</h3>
    <div aria-hidden="true" className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-text-muted">
      {weekdayLabels.map((day) => <span className="py-1" key={day.full} title={day.full}>{day.short}</span>)}
    </div>
    <div className="grid grid-cols-7 gap-1">
      {days.map(({ date, belongsToMonth }) => {
        if (!belongsToMonth) return <div aria-hidden="true" className="aspect-square min-w-0" key={date} />;
        const events = eventsByDate.get(date) ?? [];
        const chargeable = events.filter((event) => event.status !== 'SKIPPED');
        const cents = chargeable.reduce((sum, event) => sum + eventAmount(event), 0);
        const pending = chargeable.filter((event) => !['PAID', 'SKIPPED'].includes(event.status)).length;
        const paid = chargeable.length > 0 && pending === 0;
        const isToday = date === today;
        const isSelected = date === selectedDate;
        const countLabel = chargeable.length ? `${chargeable.length} ${chargeable.length === 1 ? 'gasto' : 'gastos'}`
          : events.length ? `${events.length} ${events.length === 1 ? 'pago omitido' : 'pagos omitidos'}` : 'sin gastos';
        const statusLabel = pending ? `${pending} pendiente${pending === 1 ? '' : 's'}` : paid ? 'todos pagados' : events.length ? 'solo omitidos' : 'sin gastos';
        return <button aria-label={`${formatDate(date)}, ${countLabel}, ${compactMoney(cents, currency)}, ${statusLabel}${isToday ? ', hoy' : ''}`} aria-pressed={isSelected}
          className={`relative flex aspect-square min-h-11 min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border px-0.5 py-0 text-center leading-tight focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${isSelected ? 'border-brand bg-brand-soft text-brand-strong' : 'border-border bg-surface hover:bg-surface-muted'} ${isToday ? 'ring-2 ring-brand ring-offset-1' : ''}`}
          key={date} onClick={() => onSelect(date)} ref={(node) => { if (node) buttonRefs.current.set(date, node); else buttonRefs.current.delete(date); }} type="button">
          <span className="text-sm font-bold">{Number(date.slice(8, 10))}</span>
          {chargeable.length ? <><span className="max-w-full truncate text-[10px] font-extrabold sm:text-xs">{compactMoney(cents, currency)}</span><span className="max-w-full truncate text-[9px] text-text-muted sm:text-[10px]">{chargeable.length} {chargeable.length === 1 ? 'gasto' : 'gastos'}</span></>
            : events.length ? <span className="text-[9px] text-text-muted">Omitido</span> : null}
          {pending > 0 ? <span aria-hidden="true" className="absolute right-1 top-1 size-1.5 rounded-full bg-amber-500" /> : null}
        </button>;
      })}
    </div>
    <p className="mt-2 text-xs text-text-muted"><span aria-hidden="true" className="mr-1 inline-block size-2 rounded-full bg-amber-500" />Pendiente de pago · Hoy se marca con un borde.</p>
  </section>;
}

const primaryAction = 'inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const secondaryAction = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong px-4 py-2.5 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const monthAction = 'inline-flex min-h-12 min-w-0 flex-row items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50 sm:px-3 sm:text-sm';
const calendarModes = [['CALENDAR', 'Calendario'], ['LIST', 'Lista']];
const calendarScopes = [['ALL', 'Ambos'], ['HOUSEHOLD', 'Conjunto'], ['PERSONAL', 'Personal']];
const weekdayLabels = [
  { short: 'L', full: 'Lunes' }, { short: 'M', full: 'Martes' }, { short: 'X', full: 'Miércoles' },
  { short: 'J', full: 'Jueves' }, { short: 'V', full: 'Viernes' }, { short: 'S', full: 'Sábado' }, { short: 'D', full: 'Domingo' },
];
const occurrenceKey = (event) => event.sourceType === 'RECURRING_EXPENSE'
  ? `${event.sourceType}:${event.expenseId}:${event.dueDate}`
  : sourceDetails[event.sourceType]
    ? `${event.sourceType}:${event.id}`
    : `${event.sourceType}:${event.purchaseId}:${event.installmentId ?? event.dueDate}`;

function RecordedPaymentControl({ event, householdId, timezone }) {
  const queryClient = useQueryClient();
  const [paymentDate, setPaymentDate] = useState(event.paymentDate ?? calendarToday(timezone));
  const mutation = useMutation({
    mutationFn: async (nextDate) => {
      if (event.sourceType === 'INVOICE') {
        return financeService.updateInvoice({ householdId, invoiceId: event.id, body: { paymentDate: nextDate } });
      }
      if (event.sourceType === 'ONE_TIME_EXPENSE') {
        return financeService.updateOneTimeExpense({ householdId, expenseId: event.id, body: { paymentDate: nextDate } });
      }
      return financeService.updateVariableExpensePayment({
        householdId,
        variableMonthId: event.variableMonthId,
        ...(event.sourceType === 'VARIABLE_EXPENSE' ? { entryId: event.id } : {}),
        paymentDate: nextDate,
      });
    },
    onSuccess: () => invalidateBudgetQueries(queryClient, householdId),
  });
  const isPaid = event.status === 'PAID';

  return <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(submitEvent) => {
    submitEvent.preventDefault();
    mutation.mutate(isPaid ? null : paymentDate);
  }}>
    {!isPaid ? <label className="min-w-40 flex-1 text-xs font-semibold text-text-muted">Fecha en que se pagó
      <input className="mt-1 min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-text" onChange={(changeEvent) => setPaymentDate(changeEvent.target.value)} required type="date" value={paymentDate} />
    </label> : <p className="mr-auto text-xs text-text-muted">Confirmado para el {formatDate(event.paymentDate)}</p>}
    <button className={isPaid ? secondaryAction : primaryAction} disabled={mutation.isPending} type="submit">
      {mutation.isPending ? 'Guardando…' : isPaid ? 'Deshacer pago' : 'Confirmar pago'}
    </button>
    {mutation.isError ? <p className="basis-full text-sm text-red-700" role="alert">{mutation.error?.message || 'No se pudo guardar el pago. Inténtalo de nuevo.'}</p> : null}
  </form>;
}

function CalendarEvent({ currency, event, householdId, timezone, onClose, onOpen, selection }) {
  const formId = useId();
  const headingId = useId();
  const heading = useRef(null);
  const opener = useRef(null);
  const status = statusConfig[event.status] ?? statusConfig.UPCOMING;
  const Icon = status.icon;
  const purchaseSource = isPurchaseFinancialSource(event.sourceType);
  const purchaseInstallment = event.sourceType === 'PURCHASE_INSTALLMENT';
  const recurring = event.sourceType === 'RECURRING_EXPENSE';
  const source = sourceDetails[event.sourceType];
  const canConfirmRecordedPayment = Boolean(source && ['INVOICE', 'ONE_TIME_EXPENSE', 'VARIABLE_EXPENSE', 'VARIABLE_SUMMARY'].includes(event.sourceType));
  const canRegister = event.canRegisterPayment === true && (purchaseInstallment ? event.status !== 'PAID' : recurring && !event.paymentId);
  const canEdit = event.canEditPayment === true && (purchaseInstallment ? event.status === 'PAID' : recurring && Boolean(event.paymentId));
  const paymentId = purchaseInstallment ? event.installmentId : event.paymentId;
  const isOpen = Boolean(selection && (selection.mode === 'edit'
    ? canEdit && selection.paymentId === paymentId
    : canRegister));

  useEffect(() => {
    // A refresh from another device can revoke this action without a local
    // submit. Close the stale draft and keep keyboard focus in its card.
    if (selection && !isOpen) onClose(selection, () => heading.current?.focus());
  }, [isOpen, onClose, selection]);

  function openForm(click, mode, initialStatus) {
    opener.current = click.currentTarget;
    onOpen({ eventKey: occurrenceKey(event), mode, initialStatus, paymentId });
  }

  function closeForm() {
    onClose(selection, () => {
      // After a successful save the original action may have become Edit.
      const target = opener.current?.isConnected ? opener.current : heading.current;
      target?.focus();
    });
  }

  return (
    <li aria-labelledby={headingId} className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-card [overflow-wrap:anywhere] sm:p-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-40">
          <p className="text-xs font-bold uppercase tracking-wide text-text-soft">{event.dateBasis === 'CHARGE_DATE' ? 'Cobro: ' : event.dateBasis === 'INVOICE_DATE' ? 'Emisión: ' : ''}{formatDate(event.dueDate, event.datePrecision === 'MONTH')}</p>
          <h3 className="mt-1 break-words font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" id={headingId} ref={heading} tabIndex={-1}>{event.name}</h3>
          <p className="mt-1 text-xs font-bold text-brand-strong">{purchaseSource ? purchaseFinancialSourceLabel(event.sourceType) : recurring ? 'Gasto recurrente' : source?.label ?? 'Vencimiento'}</p>
          <p className="mt-1 break-words text-sm text-text-muted">{purchaseSource ? purchaseFinancialScopeLabel(event) : event.scope === 'PERSONAL' ? `Personal${event.personalPerson?.name ? ` · ${event.personalPerson.name}` : ''}` : 'Gasto común'}{event.category?.name ? ` · ${event.category.name}` : ''}</p>
        </div>
        <div className="min-w-0 max-w-full">
          <p className="text-xs text-text-muted">{event.status === 'RECORDED' ? 'Importe registrado' : event.ownershipType === 'SPLIT' ? event.status === 'PAID' ? 'Tu parte pagada' : 'Tu parte prevista' : event.status === 'PAID' ? 'Importe pagado' : 'Importe previsto'}</p>
          <p className="break-words text-xl font-extrabold">{formatCents(event.status === 'PAID' ? event.actualAmountCents : event.expectedAmountCents ?? event.amountCents, currency)}</p>
        </div>
      </div>
      {event.datePrecision === 'MONTH' ? <p className="mt-2 text-xs leading-5 text-text-muted">Total del mes completo, sin día concreto. Se muestra si el rango incluye parte de ese mes.</p> : null}
      {purchaseSource && event.status === 'PAID' ? <p className="mt-2 text-xs leading-5 text-text-muted">Previsto para este vencimiento: {formatCents(event.expectedAmountCents, currency)}. El importe real se utiliza en el mes de la fecha de pago.</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}><Icon className="size-3.5" aria-hidden="true" />{status.label}</span>
        {event.status === 'PAID' && event.paymentDate ? <p className="text-sm text-text-muted">Fecha de pago: {formatDate(event.paymentDate)}</p> : null}
      </div>
      {canRegister || canEdit ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {canRegister ? <>
            <button aria-controls={formId} aria-expanded={isOpen && selection?.initialStatus === 'PAID'} className={primaryAction} onClick={(click) => openForm(click, 'create', 'PAID')} type="button">Marcar pagado</button>
            {recurring ? <button aria-controls={formId} aria-expanded={isOpen && selection?.initialStatus === 'SKIPPED'} className={secondaryAction} onClick={(click) => openForm(click, 'create', 'SKIPPED')} type="button">Omitir</button> : null}
          </> : (
            <button aria-controls={formId} aria-expanded={isOpen} className={secondaryAction} onClick={(click) => openForm(click, 'edit', event.status)} type="button">{purchaseInstallment ? 'Editar pago de cuota' : 'Editar registro'}</button>
          )}
        </div>
      ) : null}
      {canConfirmRecordedPayment ? <RecordedPaymentControl event={event} householdId={householdId} timezone={timezone} /> : null}
      {purchaseSource && event.canAccessPurchase === true && event.purchaseId ? <Link aria-label={`Ver compra: ${event.name}`} className="mt-3 inline-flex min-h-11 max-w-full items-center rounded-lg px-1 text-sm font-bold text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" to={`/compras/${encodeURIComponent(event.purchaseId)}`}>Ver compra</Link> : null}
      {source ? <Link className="mt-3 inline-flex min-h-11 max-w-full items-center rounded-lg px-1 text-sm font-bold text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" to={source.to}>{source.link}</Link> : null}
      {isOpen ? (
        purchaseInstallment ? <div id={formId}><CalendarPurchasePaymentForm currency={currency} event={event} householdId={householdId} key={`${selection.mode}:${paymentId}`} mode={selection.mode} onClose={closeForm} timezone={timezone} /></div> : <PaymentOccurrenceForm
          currency={currency}
          dueDate={event.dueDate}
          expense={{ id: event.expenseId, name: event.name, amountCents: event.expectedAmountCents ?? event.amountCents, nextDueDate: event.dueDate }}
          householdId={householdId}
          id={formId}
          initialStatus={selection.initialStatus}
          key={`${selection.mode}:${selection.initialStatus}:${selection.paymentId ?? 'new'}`}
          onClose={closeForm}
          payment={selection.mode === 'edit' ? { ...event, id: event.paymentId } : null}
        />
      ) : null}
    </li>
  );
}

function CalendarViewDialog({ date, events, householdId, currency, timezone, selection, onClose, onOpen, onClosePayment }) {
  const titleId = useId();
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
  const charges = events.filter((event) => event.status !== 'SKIPPED');
  const total = charges.reduce((sum, event) => sum + eventAmount(event), 0);
  const pending = charges.filter((event) => !['PAID', 'SKIPPED'].includes(event.status)).length;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section aria-labelledby={titleId} aria-modal="true" className="flex max-h-[88dvh] w-full min-w-0 flex-col rounded-t-2xl border border-border bg-surface shadow-xl sm:max-w-2xl sm:rounded-2xl" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const targets = [...dialogRef.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
        const first = targets[0]; const last = targets.at(-1);
        if (!first) event.preventDefault();
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }} ref={dialogRef} role="dialog" tabIndex={-1}>
      <header className="flex min-w-0 items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
        <div className="min-w-0"><h2 className="break-words text-lg font-extrabold" id={titleId}>{formatDate(date)}</h2><p className="mt-1 text-sm text-text-muted">{events.length ? `${formatCents(total, currency)} · ${events.length} ${events.length === 1 ? 'gasto' : 'gastos'}${pending ? ` · ${pending} pendiente${pending === 1 ? '' : 's'}` : ''}` : 'No hay gastos este día.'}</p></div>
        <button aria-label="Cerrar gastos del día" className={`${secondaryAction} size-11 shrink-0 p-2`} onClick={onClose} ref={closeRef} type="button"><X aria-hidden="true" className="size-5" /></button>
      </header>
      {events.length ? <ol className="min-h-0 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-5">
        {sortedEvents(events).map((event) => <CalendarEvent currency={currency} event={event} householdId={householdId} key={occurrenceKey(event)} onClose={onClosePayment} onOpen={onOpen} selection={selection?.eventKey === occurrenceKey(event) ? selection : null} timezone={timezone} />)}
      </ol> : <p className="p-5 text-sm text-text-muted">Este día no tiene gastos programados ni registrados.</p>}
    </section>
  </div>;
}

function HouseholdCalendar({ currentHousehold }) {
  const currentMonth = calendarToday(currentHousehold.timezone ?? 'UTC').slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [mode, setMode] = useState('CALENDAR');
  const [scope, setScope] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selection, setSelection] = useState(null);
  const selectionRef = useRef(null);
  const calendarRef = useRef(null);
  const dayButtonRefs = useRef(new Map());
  const householdId = currentHousehold.id;
  const anchorDate = `${month}-01`;
  const query = useQuery({
    queryKey: queryKeys.calendar(householdId, 'MONTH', anchorDate),
    queryFn: () => financeService.calendar(householdId, 'MONTH', anchorDate),
    enabled: Boolean(householdId),
  });
  const monthEvents = useMemo(() => sortedEvents((query.data?.events ?? []).filter((event) =>
    scope === 'ALL' || event.scope === scope)), [query.data?.events, scope]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map();
    monthEvents.filter((event) => event.datePrecision !== 'MONTH').forEach((event) => {
      grouped.set(event.dueDate, [...(grouped.get(event.dueDate) ?? []), event]);
    });
    return grouped;
  }, [monthEvents]);
  const days = useMemo(() => calendarDays(month), [month]);
  const monthlyUnscheduledEvents = monthEvents.filter((event) => event.datePrecision === 'MONTH');
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];

  const selectPayment = useCallback((nextSelection) => {
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
  }, []);

  function changeMonth(nextMonth) {
    if (nextMonth === month) return;
    if (selection && !window.confirm('Hay un formulario de pago abierto. ¿Cambiar de mes y cerrar el formulario sin guardar sus cambios?')) return;
    selectPayment(null);
    setSelectedDate(null);
    setMonth(nextMonth);
  }

  function changeScope(nextScope) {
    if (nextScope === scope) return;
    if (selection && !window.confirm('Hay un formulario de pago abierto. ¿Cambiar el filtro y cerrar el formulario sin guardar sus cambios?')) return;
    selectPayment(null);
    setSelectedDate(null);
    setScope(nextScope);
  }

  function closeDay() {
    if (selection && !window.confirm('Hay un formulario de pago abierto. ¿Cerrar los gastos del día y descartar los cambios sin guardar?')) return;
    const date = selectedDate;
    selectPayment(null);
    setSelectedDate(null);
    window.requestAnimationFrame(() => dayButtonRefs.current.get(date)?.focus());
  }

  const closePayment = useCallback((closingSelection, restoreFocus) => {
    // A late response from one card must not close another card's form.
    if (selectionRef.current !== closingSelection) return;
    selectPayment(null);
    requestAnimationFrame(() => {
      if (selectionRef.current === null) restoreFocus();
    });
  }, [selectPayment]);

  useEffect(() => {
    if (query.isError && selection) {
      closePayment(selection, () => calendarRef.current?.focus());
      return;
    }
    if (selection && query.data && !query.data.events.some((event) => occurrenceKey(event) === selection.eventKey)) {
      closePayment(selection, () => calendarRef.current?.focus());
    }
  }, [closePayment, query.data, query.isError, selection]);

  return (
    <div className="min-w-0 space-y-6 focus:outline-none" ref={calendarRef} tabIndex={-1}>
      <PageHeader title="Calendario" />
      <p className="text-sm leading-6 text-text-muted">Todos los gastos del periodo: recurrentes, facturas, variables, puntuales y pagos de compras. Incluye los gastos comunes y tus gastos personales.</p>
      <section aria-label="Mes del calendario" className="min-w-0 rounded-2xl border border-border bg-surface p-4">
        <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 aria-live="polite" aria-atomic="true" className="text-lg font-bold capitalize">{formatDate(`${month}-01`, true)}</h2>
          <div className="grid w-full grid-cols-3 gap-1 sm:w-auto sm:gap-2" role="group" aria-label="Cambiar mes">
            <button aria-label="Mes anterior" className={`${monthAction} border-border-strong hover:bg-surface-muted`} disabled={month <= '2000-01'} onClick={() => changeMonth(shiftCalendarMonth(month, -1))} type="button"><ChevronLeft aria-hidden="true" className="size-4 shrink-0" /><span>Anterior</span></button>
            <button aria-pressed={month === currentMonth} className={`${monthAction} ${month === currentMonth ? 'border-brand bg-brand text-on-brand hover:bg-brand-hover' : 'border-border-strong hover:bg-surface-muted'}`} onClick={() => changeMonth(currentMonth)} type="button">Este mes</button>
            <button aria-label="Mes siguiente" className={`${monthAction} border-border-strong hover:bg-surface-muted`} disabled={month >= '2200-12'} onClick={() => changeMonth(shiftCalendarMonth(month, 1))} type="button"><ChevronRight aria-hidden="true" className="size-4 shrink-0 sm:order-last" /><span>Siguiente</span></button>
          </div>
        </div>
      </section>
      <div aria-label="Filtrar gastos por ámbito" className="grid w-full grid-cols-3 rounded-xl border border-border bg-surface p-1" role="group">
        {calendarScopes.map(([value, label]) => <button aria-pressed={scope === value} className={`inline-flex min-h-11 min-w-0 items-center justify-center rounded-lg px-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${scope === value ? 'bg-brand text-on-brand' : 'text-text-muted hover:bg-surface-muted'}`} key={value} onClick={() => changeScope(value)} type="button">{label}</button>)}
      </div>
      <div aria-label="Vista de gastos" className="grid w-full grid-cols-2 rounded-xl border border-border bg-surface p-1" role="group">
        {calendarModes.map(([value, label]) => <button aria-pressed={mode === value} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${mode === value ? 'bg-brand text-on-brand' : 'text-text-muted hover:bg-surface-muted'}`} key={value} onClick={() => setMode(value)} type="button">
          {value === 'CALENDAR' ? <CalendarDays aria-hidden="true" className="size-4" /> : <List aria-hidden="true" className="size-4" />}{label}
        </button>)}
      </div>
      {query.isPending ? <LoadingState label="Cargando gastos" /> : null}
      {query.isError ? <ErrorState description={query.error.message} onRetry={query.refetch} /> : null}
      {query.data && !query.isError && !monthEvents.length ? <p className="rounded-xl border border-border bg-surface p-3 text-sm text-text-muted" role="status">No hay gastos para este mes. Puedes añadirlos desde Gastos.</p> : null}
      {!query.isError && (mode === 'CALENDAR' ? <DayCalendar buttonRefs={dayButtonRefs} currentMonth={month} currency={currentHousehold.currency} days={days} eventsByDate={eventsByDate} onSelect={setSelectedDate} selectedDate={selectedDate} today={calendarToday(currentHousehold.timezone ?? 'UTC')} />
        : <section aria-label="Gastos ordenados por fecha" className="min-w-0">
          {monthEvents.length ? <ol className="space-y-3">{sortedEvents(monthEvents.filter((event) => event.datePrecision !== 'MONTH')).map((event) => <CalendarEvent currency={currentHousehold.currency} event={event} householdId={householdId} key={occurrenceKey(event)} onClose={closePayment} onOpen={selectPayment} selection={selection?.eventKey === occurrenceKey(event) ? selection : null} timezone={currentHousehold.timezone} />)}</ol> : null}
          {monthlyUnscheduledEvents.length ? <section aria-labelledby="monthly-unscheduled-heading" className="mt-4 rounded-2xl border border-border bg-surface p-4">
            <h3 className="font-bold" id="monthly-unscheduled-heading">Gastos del mes sin día concreto</h3>
            <ul className="mt-3 space-y-2">{sortedEvents(monthlyUnscheduledEvents).map((event) => <li className="min-w-0 border-t border-border pt-3" key={occurrenceKey(event)}>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><div className="min-w-0"><p className="break-words font-bold">{event.name}</p><p className="text-xs text-text-muted">{sourceDetails[event.sourceType]?.label ?? 'Gasto mensual'} · {event.scope === 'PERSONAL' ? `Personal${event.personalPerson?.name ? ` · ${event.personalPerson.name}` : ''}` : 'Gasto común'}</p></div>
              <p className="shrink-0 font-extrabold">{formatCents(eventAmount(event), currentHousehold.currency)}</p></div>
              {event.sourceType === 'VARIABLE_SUMMARY' ? <RecordedPaymentControl event={event} householdId={householdId} timezone={currentHousehold.timezone} /> : null}
            </li>)}</ul>
          </section> : null}
        </section>)}
      {mode === 'CALENDAR' && selectedDate ? <CalendarViewDialog currency={currentHousehold.currency} date={selectedDate} events={selectedEvents} householdId={householdId} onClose={closeDay} onClosePayment={closePayment} onOpen={selectPayment} selection={selection} timezone={currentHousehold.timezone} /> : null}
    </div>
  );
}

export function CalendarPage() {
  const { currentHousehold, isPending } = useHousehold();
  if (isPending) return <LoadingState />;
  if (!currentHousehold?.id) {
    return <EmptyState action={<Link className="font-bold text-brand-strong" to="/hogar">Crear hogar</Link>} description="Cuando configures un hogar podrás consultar sus gastos en el calendario." icon={CalendarDays} title="No hay un hogar seleccionado" />;
  }
  return <HouseholdCalendar currentHousehold={currentHousehold} key={currentHousehold.id} />;
}
