import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  CircleCheck,
  CircleGauge,
  Landmark,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { queryKeys } from '../api/queryKeys';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ContributionBreakdown } from '../features/finance/components/ContributionBreakdown';
import { financeService } from '../features/finance/financeService';
import { formatCents, isoDate } from '../features/finance/money';
import { useHousehold } from '../features/households/useHousehold';

function getMonthLabel(dateValue) {
  const parsedDate = dateValue
    ? new Date(`${isoDate(dateValue)}T12:00:00.000Z`)
    : new Date();
  const value = new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(parsedDate);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function dateDay(dateValue) {
  const match = /\d{4}-\d{2}-(\d{2})/.exec(dateValue ?? '');
  return match ? Number(match[1]) : null;
}

export function DashboardPage() {
  const householdState = useHousehold();
  const householdId = householdState.currentHousehold?.id;
  const dashboard = useQuery({
    queryKey: queryKeys.dashboard(householdId, 'current'),
    queryFn: () => financeService.dashboard(householdId),
    enabled: Boolean(householdId),
  });

  if (householdState.isPending) return <LoadingState label="Cargando hogar" />;
  if (householdState.isError) {
    return <ErrorState description={householdState.error.message} onRetry={householdState.refetch} />;
  }

  if (!householdId) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow={getMonthLabel()}
          title="¿Cuánto necesitas aportar este mes?"
        />
        <EmptyState
          action={
            <Link className="inline-flex min-h-12 items-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-on-brand" to="/hogar">
              Crear mi hogar
            </Link>
          }
          description="Con un hogar podremos calcular el presupuesto sin inventar cifras ni mezclar gastos personales y comunes."
          icon={UsersRound}
          title="Configura tu hogar para empezar"
        />
      </div>
    );
  }

  if (dashboard.isPending) return <LoadingState label="Calculando presupuesto" />;
  if (dashboard.isError) {
    return <ErrorState description={dashboard.error.message} onRetry={dashboard.refetch} />;
  }

  const data = dashboard.data;
  const ready = data.budget.readiness.ready;
  const hasPlanning = Boolean(data.planning);
  const hasPendingAdjustment = !hasPlanning && Boolean(data.activeRecoveryPlan);
  const contributions = data.planning?.contributions?.length
    ? data.planning.contributions.map((item) => ({
        personId: item.householdPersonId,
        personName: item.personName,
        householdCents: item.standardHouseholdCents,
        personalCents: item.personalExpenseCents,
        contributionBps: item.contributionBps,
        adjustmentCents: item.temporaryAdjustmentCents,
        totalCents: item.totalRecommendedCents,
      }))
    : data.budget.contributions.map((item) => ({
        ...item,
        householdCents: item.standardHouseholdCents,
        personalCents: item.personalExpenseCents,
        contributionBps: item.contributionBps,
        adjustmentCents: 0,
        totalCents: item.totalStandardCents,
      }));
  const householdTotal = hasPlanning
    ? contributions.reduce((total, item) => total + item.householdCents, 0)
    : data.budget.householdBudgetCents;
  const personalTotal = hasPlanning
    ? contributions.reduce((total, item) => total + item.personalCents, 0)
    : data.budget.personalBudgetCents;
  const standardTotal = householdTotal + personalTotal;
  const adjustmentTotal = hasPlanning
    ? contributions.reduce((total, item) => total + item.adjustmentCents, 0)
    : data.activeRecoveryPlan?.monthlyAdjustmentCents ?? 0;
  const recommended = hasPlanning
    ? contributions.reduce((total, item) => total + item.totalCents, 0)
    : standardTotal + adjustmentTotal;
  const currency = data.household.currency;
  const contributionDay = data.household.contributionDay
    ?? householdState.currentHousehold.contributionDay
    ?? 1;
  const beforeContributionDay = dateDay(data.calculationDate) < contributionDay;
  const monthLabel = getMonthLabel(data.calculationDate);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={monthLabel}
        title="¿Cuánto necesitáis aportar este mes?"
      />

      {!ready ? (
        <EmptyState
          action={<Link className="inline-flex min-h-12 items-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-on-brand" to="/hogar">Completar reparto</Link>}
          description="Las personas activas deben tener un reparto porcentual que sume exactamente el 100 %."
          icon={WalletCards}
          title="El presupuesto aún no se puede calcular"
        />
      ) : (
        <>
          {!hasPlanning ? (
            <section
              className="flex items-start gap-3 rounded-2xl border border-border bg-brand-soft p-4 text-text"
              role="status"
            >
              <CalendarClock
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-brand-strong"
              />
              <div>
                <h2 className="font-bold">
                  {beforeContributionDay
                    ? 'Pendiente de confirmar saldos'
                    : `Confirma los saldos de ${monthLabel.toLocaleLowerCase('es-ES')}`}
                </h2>
                <p className="mt-1 text-sm leading-6 text-text-muted">
                  {beforeContributionDay
                    ? `La confirmación mensual está prevista para el día ${contributionDay}. Necesitamos el saldo conjunto y el saldo personal de cada persona para calcular el estado real.`
                    : 'Introduce el saldo conjunto y los saldos personales para actualizar las aportaciones y comprobar si las cuentas van bien.'}
                </p>
              </div>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-3xl bg-brand-deep px-5 py-6 text-on-brand shadow-elevated sm:px-8 sm:py-8" aria-labelledby="aportacion-recomendada">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-on-brand-muted" id="aportacion-recomendada">
                  {hasPlanning ? 'Aportación total recomendada' : 'Presupuesto estimado del mes'}
                </p>
                <p className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{formatCents(recommended, currency)}</p>
              </div>
              <StatusBadge>
                {hasPlanning
                  ? data.planning.fundingStatus === 'FUNDED'
                    ? 'Fondos confirmados'
                    : 'Mes preparado'
                  : 'Pendiente de preparar'}
              </StatusBadge>
            </div>
            <dl className="mt-6 grid gap-3 border-t border-on-brand/15 pt-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs font-semibold text-on-brand-muted">Gastos comunes</dt>
                <dd className="mt-1 font-extrabold">{formatCents(householdTotal, currency)}</dd>
                <dd className="mt-1 text-xs text-on-brand-muted">Incluye {formatCents(data.budget.householdMarginCents, currency)} de margen</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-on-brand-muted">Gastos personales</dt>
                <dd className="mt-1 font-extrabold">{formatCents(personalTotal, currency)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-on-brand-muted">Ajuste conjunto</dt>
                <dd className="mt-1 font-extrabold">{formatCents(adjustmentTotal, currency)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-on-brand-muted">Total a aportar</dt>
                <dd className="mt-1 font-extrabold">{formatCents(recommended, currency)}</dd>
              </div>
            </dl>
            <p className="mt-5 max-w-3xl text-sm leading-6 text-on-brand-muted">
              Los gastos comunes se reparten entre las personas según su porcentaje. Después se suman los gastos personales de cada una. El ajuste temporal solo modifica la parte común.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {contributions.map((contribution) => (
                <article
                  aria-label={`Aportación de ${contribution.personName}`}
                  className="rounded-2xl bg-on-brand/10 p-4"
                  key={contribution.personId}
                >
                  <p className="text-sm text-on-brand-muted">{contribution.personName}</p>
                  <ContributionBreakdown
                    adjustmentCents={contribution.adjustmentCents}
                    currency={currency}
                    householdCents={contribution.householdCents}
                    contributionBps={contribution.contributionBps}
                    inverted
                    pendingAdjustment={hasPendingAdjustment}
                    personalCents={contribution.personalCents}
                    totalCents={contribution.totalCents}
                  />
                </article>
              ))}
            </div>
            {!data.planning ? (
              <Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-on-brand px-4 py-2 text-sm font-bold text-brand-deep" to="/planificacion">Confirmar saldos del mes</Link>
            ) : null}
            {data.nextPayment ? (
              <section className="mt-5 border-t border-on-brand/15 pt-5" aria-labelledby="registrar-proximo-pago">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-on-brand-muted">Próximo vencimiento</p>
                    <h2 className="mt-1 font-extrabold" id="registrar-proximo-pago">{data.nextPayment.name}</h2>
                    <p className="mt-1 text-sm text-on-brand-muted">
                      {isoDate(data.nextPayment.dueDate)} · {formatCents(data.nextPayment.amountCents, currency)}
                    </p>
                  </div>
                  <Link
                    aria-label={`Registrar pago de ${data.nextPayment.name}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-on-brand/30 bg-on-brand/10 px-4 py-2.5 text-sm font-bold text-on-brand hover:bg-on-brand/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    to={`/gastos/recurrentes/${data.nextPayment.expenseId}?action=register-payment`}
                  >
                    <CircleCheck aria-hidden="true" className="size-4" />
                    Registrar pago
                  </Link>
                </div>
              </section>
            ) : null}
          </section>

          <section aria-labelledby="resumen-hogar">
            <h2 className="text-lg font-bold text-text" id="resumen-hogar">Resumen del hogar</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
              <MetricCard icon={CircleGauge} label="Presupuesto hogar" value={formatCents(data.budget.householdBudgetCents, currency)} />
              <MetricCard helper={data.nextPayment ? isoDate(data.nextPayment.dueDate) : 'Sin pagos próximos'} icon={CalendarClock} label="Próximo pago" value={data.nextPayment ? formatCents(data.nextPayment.amountCents, currency) : '—'} />
              <MetricCard helper={!hasPlanning ? 'Pendiente de confirmar los saldos' : undefined} icon={Landmark} label="Saldo conjunto" value={formatCents(data.balanceCents, currency)} />
            </div>
            <Link className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-border-strong px-4 py-2 text-sm font-bold text-brand-strong hover:bg-brand-soft" to="/cuentas">
              {data.accountSummary?.hasAccounts ? 'Editar cuentas y saldos' : 'Configurar cuentas y saldos'}
            </Link>
          </section>

          {data.accountSummary?.hasAccounts ? (
            <section aria-labelledby="estado-cuentas" className="rounded-2xl border border-border bg-surface p-5 shadow-card">
              <h2 className="font-bold text-text" id="estado-cuentas">Estado de las cuentas</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <article className="rounded-xl bg-surface-muted p-4">
                  <p className="text-sm font-bold text-text">Cuenta conjunta</p>
                  <p className="mt-1 text-sm text-text-muted">Disponible {formatCents(data.accountSummary.common.balanceCents, currency)} · Necesario {formatCents(data.accountSummary.common.requiredCents, currency)}</p>
                  <p className={`mt-2 text-sm font-extrabold ${data.accountSummary.common.status === 'OK' ? 'text-brand-strong' : 'text-red-700'}`}>{data.accountSummary.common.status === 'OK' ? 'Va bien' : 'En números rojos'} ({formatCents(data.accountSummary.common.differenceCents, currency)})</p>
                </article>
                {data.accountSummary.personal.map((account) => (
                  <article className="rounded-xl bg-surface-muted p-4" key={account.personId}>
                    <p className="text-sm font-bold text-text">Cuenta de {account.personName}</p>
                    <p className="mt-1 text-sm text-text-muted">Disponible {formatCents(account.balanceCents, currency)} · Aportación necesaria {formatCents(account.requiredCents, currency)}</p>
                    <p className={`mt-2 text-sm font-extrabold ${account.status === 'OK' ? 'text-brand-strong' : 'text-red-700'}`}>{account.status === 'OK' ? 'Va bien' : 'En números rojos'} ({formatCents(account.differenceCents, currency)})</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-bold text-text">Cómo se ha calculado</h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {data.budget.sourceCoverage.recurringCount} gastos recurrentes, {data.budget.sourceCoverage.invoiceCategoryCount} categorías con facturas, {data.budget.sourceCoverage.variableCategoryCount} grupos variables y {data.budget.sourceCoverage.oneTimeCount ?? 0} gastos puntuales. Margen general: {data.household.safetyMarginBps === 0 ? 'sin margen' : `${data.household.safetyMarginBps / 100} %`}.
            </p>
            <Link className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-brand-strong" to="/presupuesto">Ver desglose del presupuesto</Link>
          </section>
        </>
      )}
    </div>
  );
}
