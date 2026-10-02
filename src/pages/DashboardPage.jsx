import { useQuery } from '@tanstack/react-query';
import { UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';

import { queryKeys } from '../api/queryKeys';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { MonthlyAccountOverview } from '../features/finance/components/MonthlyAccountOverview';
import { financeService } from '../features/finance/financeService';
import { isoDate } from '../features/finance/money';
import { nextPlanningMonth, planningMonthLabel } from '../features/finance/planningMonth';
import { useHousehold } from '../features/households/useHousehold';
import { todayIso } from './expensePageUtils';

const linkClass = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong px-4 py-2 text-sm font-bold text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export function DashboardPage() {
  const householdState = useHousehold();
  const householdId = householdState.currentHousehold?.id;
  const dashboard = useQuery({
    queryKey: queryKeys.dashboard(householdId, 'current'),
    queryFn: () => financeService.dashboard(householdId),
    enabled: Boolean(householdId),
  });

  if (householdState.isPending) return <LoadingState label="Cargando hogar" />;
  if (householdState.isError) return <ErrorState description={householdState.error.message} onRetry={householdState.refetch} />;
  if (!householdId) return <EmptyState action={<Link className={linkClass} to="/hogar">Crear mi hogar</Link>} description="Separa los gastos comunes y tus gastos personales desde el principio." icon={UsersRound} title="Configura tu hogar para empezar" />;
  if (dashboard.isPending) return <LoadingState label="Cargando cuentas y gastos del mes" />;
  if (dashboard.isError) return <ErrorState description={dashboard.error.message} onRetry={dashboard.refetch} />;

  const data = dashboard.data;
  const month = isoDate(data.calculationDate || todayIso()).slice(0, 7);
  const nextMonth = nextPlanningMonth(data.calculationDate || todayIso());
  const overview = data.monthlyOverview;
  const planning = data.planning;
  const extrasPending = planning?.extraFunding?.pendingCents > 0;

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader eyebrow={planningMonthLabel(month)} title="Tu dinero este mes" description="Del día 1 al último: qué hay en las cuentas y qué falta por pagar." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-text-muted">Usamos los saldos que has anotado, no una conexión con tu banco. Actualízalos después de pagar o hacer transferencias.</p>
        <Link className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" to="/cuentas">Actualizar saldos</Link>
      </div>
      {!data.budget.readiness.ready ? <p className="rounded-xl border border-border bg-surface p-4 text-sm leading-6" role="status">Falta completar el reparto del hogar. Mostramos los gastos registrados, pero la estimación mensual aún está incompleta. <Link className="inline-flex min-h-11 items-center font-bold text-brand-strong underline" to="/hogar">Completar reparto</Link></p> : null}
      {overview?.common ? <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
        <MonthlyAccountOverview currency={data.household.currency} overview={overview.common} scope="common" title="Cuenta conjunta" forecastReady={data.budget.readiness.ready} />
        {overview.personal ? <MonthlyAccountOverview currency={data.household.currency} overview={overview.personal} scope="personal" title="Tus cuentas personales" forecastReady={data.budget.readiness.ready} /> : <section className="min-w-0 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-lg font-bold">Tus gastos personales</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">Vincula tu usuario a una persona del hogar para ver aquí tus datos. Los de otras personas son privados.</p>
          <Link className={`mt-3 ${linkClass}`} to="/hogar">Revisar mi vinculación</Link>
        </section>}
      </div> : <ErrorState title="Resumen mensual no disponible" description="No se han recibido los nuevos datos del mes. Comprueba que el servidor esté actualizado y vuelve a cargar." onRetry={dashboard.refetch} />}
      <section aria-labelledby="transfers-heading" className="min-w-0 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-bold" id="transfers-heading">¿Cuánto tenemos que ingresar?</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">Eso se prepara en Planificación: las aportaciones incluyen el ahorro para pagos futuros y el colchón. No son otro gasto ni se suman a los gastos de arriba.</p>
        {planning ? <p className="mt-2 text-sm font-semibold" role="status">{extrasPending ? 'Hay aportaciones extra pendientes de ingresar.' : planning.fundingStatus === 'FUNDED' ? 'Las aportaciones preparadas de este mes están confirmadas.' : 'Las aportaciones están guardadas; quedan ingresos por confirmar.'}</p> : null}
        {planning?.budgetChangedSincePreparation ? <p className="mt-2 text-sm text-text-muted" role="status">Han cambiado los gastos desde que preparaste el mes. Revisa las diferencias en Planificación; las aportaciones guardadas no se han cambiado.</p> : null}
        <div className="mt-3 flex flex-wrap gap-3">
          <Link className={linkClass} to={`/planificacion?mes=${month}`}>{planning ? 'Ver aportaciones de este mes' : 'Preparar aportaciones de este mes'}</Link>
          <Link className={linkClass} to={`/planificacion?mes=${nextMonth}`}>Preparar {planningMonthLabel(nextMonth)}</Link>
        </div>
      </section>
    </div>
  );
}
