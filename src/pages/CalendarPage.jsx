import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CircleCheck, Clock3, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { queryKeys } from '../api/queryKeys';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { financeService } from '../features/finance/financeService';
import { PaymentOccurrenceForm } from '../features/finance/PaymentOccurrenceForm';
import { formatCents } from '../features/finance/money';
import { useHousehold } from '../features/households/useHousehold';
import { CalendarPurchasePaymentForm } from '../features/purchases/CalendarPurchasePaymentForm';
import { isPurchaseFinancialSource, purchaseFinancialScopeLabel, purchaseFinancialSourceLabel } from '../features/purchases/purchaseFinancialPresentation';

const views = [
  ['MONTH', 'Este mes'],
  ['30_DAYS', '30 días'],
  ['90_DAYS', '90 días'],
  ['YEAR', 'Año'],
];

const statusConfig = {
  PAID: { label: 'Pagado', icon: CircleCheck, className: 'bg-emerald-100 text-emerald-800' },
  SKIPPED: { label: 'Omitido', icon: CircleCheck, className: 'bg-surface-muted text-text-muted' },
  OVERDUE: { label: 'Atrasado', icon: TriangleAlert, className: 'bg-red-100 text-red-800' },
  DUE: { label: 'Vence hoy', icon: Clock3, className: 'bg-amber-100 text-amber-900' },
  UPCOMING: { label: 'Próximo', icon: Clock3, className: 'bg-brand-soft text-brand-strong' },
};

function formatDate(date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

const primaryAction = 'inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const secondaryAction = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong px-4 py-2.5 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const occurrenceKey = (event) => event.sourceType === 'RECURRING_EXPENSE'
  ? `${event.sourceType}:${event.expenseId}:${event.dueDate}`
  : `${event.sourceType}:${event.purchaseId}:${event.installmentId ?? event.dueDate}`;

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
          <p className="text-xs font-bold uppercase tracking-wide text-text-soft">{formatDate(event.dueDate)}</p>
          <h3 className="mt-1 break-words font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" id={headingId} ref={heading} tabIndex={-1}>{event.name}</h3>
          <p className="mt-1 text-xs font-bold text-brand-strong">{purchaseSource ? purchaseFinancialSourceLabel(event.sourceType) : recurring ? 'Gasto recurrente' : 'Vencimiento'}</p>
          <p className="mt-1 break-words text-sm text-text-muted">{purchaseSource ? purchaseFinancialScopeLabel(event) : event.scope === 'PERSONAL' ? `Personal${event.personalPerson?.name ? ` · ${event.personalPerson.name}` : ''}` : 'Gasto común'}{event.category?.name ? ` · ${event.category.name}` : ''}</p>
        </div>
        <div className="min-w-0 max-w-full">
          <p className="text-xs text-text-muted">{event.ownershipType === 'SPLIT' ? event.status === 'PAID' ? 'Tu parte pagada' : 'Tu parte prevista' : event.status === 'PAID' ? 'Importe pagado' : 'Importe previsto'}</p>
          <p className="break-words text-xl font-extrabold">{formatCents(event.status === 'PAID' ? event.actualAmountCents : event.expectedAmountCents ?? event.amountCents, currency)}</p>
        </div>
      </div>
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
      {purchaseSource && event.canAccessPurchase === true && event.purchaseId ? <Link aria-label={`Ver compra: ${event.name}`} className="mt-3 inline-flex min-h-11 max-w-full items-center rounded-lg px-1 text-sm font-bold text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" to={`/compras/${encodeURIComponent(event.purchaseId)}`}>Ver compra</Link> : null}
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

function HouseholdCalendar({ currentHousehold }) {
  const [view, setView] = useState('30_DAYS');
  const [selection, setSelection] = useState(null);
  const selectionRef = useRef(null);
  const calendarRef = useRef(null);
  const householdId = currentHousehold.id;
  const query = useQuery({
    queryKey: queryKeys.calendar(householdId, view),
    queryFn: () => financeService.calendar(householdId, view),
    enabled: Boolean(householdId),
  });

  const selectPayment = useCallback((nextSelection) => {
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
  }, []);

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
      <p className="text-sm leading-6 text-text-muted">Registra el siguiente vencimiento pendiente de cada gasto o la primera cuota pendiente de una compra, aunque la pagues por adelantado. Después podrás gestionar la siguiente. Las cuotas de compra no se pueden omitir.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Rango del calendario">
        {views.map(([value, label]) => (
          <button aria-pressed={view === value} className={`min-h-11 rounded-xl px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${view === value ? 'bg-brand text-on-brand' : 'border border-border bg-surface text-text-muted'}`} key={value} onClick={() => { selectPayment(null); setView(value); }} type="button">{label}</button>
        ))}
      </div>
      {query.isPending ? <LoadingState label="Cargando vencimientos" /> : null}
      {query.isError ? <ErrorState description={query.error.message} onRetry={query.refetch} /> : null}
      {query.data && !query.isError && !query.data.events.length ? (
        <EmptyState action={<Link className="font-bold text-brand-strong" to="/gastos/recurrentes">Añadir gasto recurrente</Link>} description={`No hay vencimientos entre ${formatDate(query.data.rangeStart)} y ${formatDate(query.data.rangeEnd)}.`} icon={CalendarDays} title="No hay pagos programados" />
      ) : null}
      {query.data?.events.length && !query.isError ? (
        <section aria-labelledby="calendar-events">
          <h2 className="sr-only" id="calendar-events">Vencimientos</h2>
          <ol className="space-y-3">
            {query.data.events.map((event) => <CalendarEvent currency={currentHousehold.currency} event={event} householdId={householdId} key={occurrenceKey(event)} onClose={closePayment} onOpen={selectPayment} selection={selection?.eventKey === occurrenceKey(event) ? selection : null} timezone={currentHousehold.timezone} />)}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

export function CalendarPage() {
  const { currentHousehold, isPending } = useHousehold();
  if (isPending) return <LoadingState />;
  if (!currentHousehold?.id) {
    return <EmptyState action={<Link className="font-bold text-brand-strong" to="/hogar">Crear hogar</Link>} description="Cuando configures un hogar podrás consultar todos sus vencimientos." icon={CalendarDays} title="No hay un hogar seleccionado" />;
  }
  return <HouseholdCalendar currentHousehold={currentHousehold} key={currentHousehold.id} />;
}
