import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CircleCheck, UsersRound, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';

import { queryKeys } from '../api/queryKeys';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ContributionBreakdown } from '../features/finance/components/ContributionBreakdown';
import { CashCoverage, MonthlyBudgetProgress } from '../features/finance/components/MonthlyBudgetProgress';
import { financeService } from '../features/finance/financeService';
import { formatCents, isoDate } from '../features/finance/money';
import { useHousehold } from '../features/households/useHousehold';

function getMonthLabel(dateValue) {
  const parsedDate = dateValue ? new Date(`${isoDate(dateValue)}T12:00:00.000Z`) : new Date();
  const value = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC', year: 'numeric' }).format(parsedDate);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

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
  if (!householdId) {
    return (
      <div className="min-w-0 space-y-8">
        <PageHeader eyebrow={getMonthLabel()} title="¿Cómo vais este mes?" />
        <EmptyState action={<Link className={linkClass} to="/hogar">Crear mi hogar</Link>} description="Con un hogar podremos calcular el presupuesto sin inventar cifras ni mezclar gastos personales y comunes." icon={UsersRound} title="Configura tu hogar para empezar" />
      </div>
    );
  }
  if (dashboard.isPending) return <LoadingState label="Calculando presupuesto" />;
  if (dashboard.isError) return <ErrorState description={dashboard.error.message} onRetry={dashboard.refetch} />;

  const data = dashboard.data;
  const ready = data.budget.readiness.ready;
  const hasPlanning = Boolean(data.planning);
  const hasPendingAdjustment = !hasPlanning && Boolean(data.activeRecoveryPlan);
  const contributions = data.planning?.contributions?.length
    ? data.planning.contributions.map((item) => ({
        personId: item.householdPersonId, personName: item.personName,
        householdCents: item.standardHouseholdCents, personalCents: item.personalExpenseCents,
        contributionBps: item.contributionBps, adjustmentCents: item.temporaryAdjustmentCents,
        totalCents: item.totalRecommendedCents,
      }))
    : data.budget.contributions.map((item) => ({
        ...item, householdCents: item.standardHouseholdCents, personalCents: item.personalExpenseCents,
        adjustmentCents: 0, totalCents: item.totalStandardCents,
      }));
  const currency = data.household.currency;
  const contributionDay = data.household.contributionDay ?? householdState.currentHousehold.contributionDay ?? 1;
  const beforeContributionDay = Number(isoDate(data.calculationDate).slice(8, 10)) < contributionDay;
  const monthLabel = getMonthLabel(data.calculationDate);
  const commonProgress = data.monthlyProgress?.common;
  const personalProgress = data.monthlyProgress?.personal;
  const nextPurchasePayment = ['PURCHASE_UPFRONT', 'PURCHASE_INSTALLMENT', 'PURCHASE_DOWN_PAYMENT'].includes(data.nextPayment?.sourceType);

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader eyebrow={monthLabel} title="¿Cómo vais este mes?" />
      {!ready ? (
        <EmptyState action={<Link className={linkClass} to="/hogar">Completar reparto</Link>} description="Las personas activas deben tener un reparto porcentual que sume exactamente el 100 %." icon={WalletCards} title="El presupuesto aún no se puede calcular" />
      ) : (
        <>
          {commonProgress ? <MonthlyBudgetProgress currency={currency} estimated={!hasPlanning} primary progress={commonProgress} title="Presupuesto común del mes" /> : <ErrorState description="No se ha recibido el resumen mensual. Vuelve a cargar los datos." onRetry={dashboard.refetch} title="Resumen mensual no disponible" />}
          {data.cashCoverage?.common ? <CashCoverage coverage={data.cashCoverage.common} currency={currency} title="¿El saldo conjunto cubre lo que queda?" /> : null}
          <Link className={linkClass} to="/cuentas">{data.accountSummary?.hasAccounts ? 'Editar cuentas y saldos' : 'Configurar cuentas y saldos'}</Link>
          {!hasPlanning ? (
            <section className="flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-brand-soft p-4" role="status">
              <CalendarClock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-strong" />
              <div className="min-w-0">
                <h2 className="font-bold">{beforeContributionDay ? 'Pendiente de confirmar saldos' : `Confirma los saldos de ${monthLabel.toLocaleLowerCase('es-ES')}`}</h2>
                <p className="mt-1 text-sm leading-6 text-text-muted">Los saldos del mes todavía no están confirmados. El progreso utiliza los gastos reales registrados.</p>
                <p className="mt-1 text-sm leading-6 text-text-muted">{beforeContributionDay ? `La confirmación mensual está prevista para el día ${contributionDay}.` : 'Introduce el saldo conjunto y los saldos personales para preparar las aportaciones del mes.'}</p>
                <Link className={`mt-3 ${linkClass}`} to="/planificacion">Confirmar saldos del mes</Link>
              </div>
            </section>
          ) : null}
          {personalProgress ? (
            <div className="min-w-0 space-y-4">
              <MonthlyBudgetProgress currency={currency} estimated={!hasPlanning} progress={personalProgress} title="Tu presupuesto personal" />
              <CashCoverage coverage={data.cashCoverage?.personal} currency={currency} title="Tu saldo personal" />
              <p className="text-xs leading-5 text-text-muted">Solo tus gastos personales. La aportación a la cuenta conjunta se muestra aparte; los saldos de ambas cuentas no se suman.</p>
            </div>
          ) : null}
          {data.nextPayment ? (
            <section aria-labelledby="registrar-proximo-pago" className="min-w-0 rounded-2xl border border-border bg-surface p-5">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Próximo vencimiento</p>
                  {nextPurchasePayment ? <p className="mt-1 text-sm font-semibold text-brand-strong">{data.nextPayment.sourceType === 'PURCHASE_INSTALLMENT' ? 'Cuota de compra' : data.nextPayment.sourceType === 'PURCHASE_DOWN_PAYMENT' ? 'Entrada de compra' : 'Compra al contado'}</p> : null}
                  <h2 className="mt-1 break-words font-extrabold" id="registrar-proximo-pago">{data.nextPayment.name}</h2>
                  <p className="mt-1 break-words text-sm text-text-muted">{isoDate(data.nextPayment.dueDate)} · {nextPurchasePayment && data.nextPayment.ownershipType === 'SPLIT' ? 'Tu parte: ' : ''}{formatCents(data.nextPayment.amountCents, currency)}</p>
                </div>
                <Link aria-label={`${nextPurchasePayment ? 'Ver pagos de' : 'Registrar pago de'} ${data.nextPayment.name}`} className={`${linkClass} gap-2`} to={nextPurchasePayment ? `/compras/${data.nextPayment.purchaseId}` : `/gastos/recurrentes/${data.nextPayment.expenseId}?action=register-payment`}><CircleCheck aria-hidden="true" className="size-4 shrink-0" />{nextPurchasePayment ? 'Ver pagos de la compra' : 'Registrar pago'}</Link>
              </div>
              <Link className={`mt-3 ${linkClass}`} to="/calendario">Ver calendario</Link>
            </section>
          ) : null}
          <section aria-labelledby="aportaciones-mes" className="min-w-0 rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-bold" id="aportaciones-mes">{hasPlanning ? 'Aportaciones del mes preparado' : 'Aportaciones estimadas'}</h2>
              <StatusBadge>{hasPlanning ? data.planning.fundingStatus === 'FUNDED' ? 'Fondos confirmados' : 'Mes preparado' : 'Pendiente de preparar'}</StatusBadge>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-muted">Las aportaciones financian el mes; no son el presupuesto que queda. El ajuste temporal solo modifica la aportación común.</p>
            {data.planning?.budgetChangedSincePreparation ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950" role="status">El presupuesto ha cambiado desde que preparaste el mes. Estas aportaciones se han actualizado con las obligaciones actuales, incluidas las compras. Los saldos confirmados y el registro de preparación se conservan; revisa si necesitas aportar la diferencia.</p> : null}
            {data.planning?.personalHistoryRequiresConfirmation ? <p className="mt-3 text-sm leading-6 text-text-muted" role="status">Esta preparación antigua no guardaba la identidad vinculada a cada saldo personal. Por privacidad no usamos esos saldos para calcular tu cobertura. <Link className="inline-flex min-h-11 items-center font-bold text-brand-strong underline focus-visible:outline-2 focus-visible:outline-focus" to="/cuentas">Actualiza tu saldo en Cuentas</Link>.</p> : null}
            <div className="mt-4 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3">
              {contributions.map((contribution) => (
                <article aria-label={`Aportación de ${contribution.personName}`} className="min-w-0 rounded-2xl bg-surface-muted p-4" key={contribution.personId}>
                  <h3 className="break-words font-bold">{contribution.personName}</h3>
                  <ContributionBreakdown adjustmentCents={contribution.adjustmentCents} currency={currency} householdCents={contribution.householdCents} contributionBps={contribution.contributionBps} pendingAdjustment={hasPendingAdjustment} personalCents={contribution.personalCents} totalCents={contribution.totalCents} />
                </article>
              ))}
            </div>
            <Link className={`mt-4 ${linkClass}`} to="/planificacion">Ver planificación mensual</Link>
          </section>
          <details className="min-w-0 rounded-2xl border border-border bg-surface p-5">
            <summary className="min-h-11 cursor-pointer content-center font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Cómo se ha calculado</summary>
            <p className="mt-2 text-sm leading-6 text-text-muted">Utilizado suma pagos recurrentes por su vencimiento, variables del mes y facturas por fecha de cobro (o emisión si no hay fecha de cobro). Los omitidos no suman.</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">Los gastos puntuales forman parte del presupuesto, pero aún no tienen un registro de pago: no se descuentan como utilizados. El margen no gastado sigue dentro del presupuesto restante.</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">Compras: el contado y la entrada confirmada cuentan en el mes de pago; la entrada pendiente, en el mes de compra. Cada cuota cuenta en el presupuesto de su vencimiento, nunca el precio completo de la compra financiada. Solo los pagos confirmados suman utilizado, por su importe real y su fecha de pago, aunque se anticipen. Las cuotas anuladas no suman.</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">Los gastos recurrentes de varios meses se prorratean en el presupuesto recomendado; lo utilizado recoge el pago completo del mes. No es una previsión bancaria y registrar pagos no cambia automáticamente los saldos de las cuentas.</p>
            <Link className={`mt-3 ${linkClass}`} to="/presupuesto">Ver desglose del presupuesto</Link>
          </details>
        </>
      )}
    </div>
  );
}
