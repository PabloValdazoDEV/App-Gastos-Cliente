import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CircleCheck, Clock3, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { financeService } from '../features/finance/financeService';
import { formatCents } from '../features/finance/money';
import { useHousehold } from '../features/households/useHousehold';

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

export function CalendarPage() {
  const [view, setView] = useState('30_DAYS');
  const { currentHousehold, isPending: householdPending } = useHousehold();
  const householdId = currentHousehold?.id;
  const query = useQuery({
    queryKey: ['calendar', householdId, view],
    queryFn: () => financeService.calendar(householdId, view),
    enabled: Boolean(householdId),
  });

  if (householdPending) return <LoadingState />;
  if (!householdId) {
    return <EmptyState action={<Link className="font-bold text-brand-strong" to="/hogar">Crear hogar</Link>} description="Cuando configures un hogar podrás consultar todos sus vencimientos." icon={CalendarDays} title="No hay un hogar seleccionado" />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Calendario" />
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Rango del calendario">
        {views.map(([value, label]) => (
          <button className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold ${view === value ? 'bg-brand text-on-brand' : 'border border-border bg-surface text-text-muted'}`} key={value} onClick={() => setView(value)} type="button">{label}</button>
        ))}
      </div>
      {query.isPending ? <LoadingState label="Cargando vencimientos" /> : null}
      {query.isError ? <ErrorState description={query.error.message} onRetry={query.refetch} /> : null}
      {query.data && !query.data.events.length ? (
        <EmptyState action={<Link className="font-bold text-brand-strong" to="/gastos/recurrentes">Añadir gasto recurrente</Link>} description={`No hay vencimientos entre ${formatDate(query.data.rangeStart)} y ${formatDate(query.data.rangeEnd)}.`} icon={CalendarDays} title="No hay pagos programados" />
      ) : null}
      {query.data?.events.length ? (
        <section aria-labelledby="calendar-events">
          <h2 className="sr-only" id="calendar-events">Vencimientos</h2>
          <ol className="space-y-3">
            {query.data.events.map((event) => {
              const status = statusConfig[event.status] ?? statusConfig.UPCOMING;
              const Icon = status.icon;
              return (
                <li className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5" key={`${event.expenseId}-${event.dueDate}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-text-soft">{formatDate(event.dueDate)}</p>
                      <h3 className="mt-1 font-bold">{event.name}</h3>
                      <p className="mt-1 text-sm text-text-muted">{event.scope === 'PERSONAL' ? `Personal${event.personalPerson?.name ? ` · ${event.personalPerson.name}` : ''}` : 'Gasto común'}{event.category?.name ? ` · ${event.category.name}` : ''}</p>
                    </div>
                    <p className="text-xl font-extrabold">{formatCents(event.amountCents, currentHousehold.currency)}</p>
                  </div>
                  <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}><Icon className="size-3.5" aria-hidden="true" />{status.label}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
