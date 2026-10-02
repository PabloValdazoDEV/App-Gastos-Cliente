import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChartNoAxesCombined, CheckCircle2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';

import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { ContributionBreakdown } from '../features/finance/components/ContributionBreakdown';
import { PlanningBudgetDetails } from '../features/finance/components/PlanningBudgetDetails';
import { PlanningCorrections } from '../features/finance/components/PlanningCorrections';
import { PlanningExtras } from '../features/finance/components/PlanningExtras';
import { isPlanningMonth, nextPlanningMonth, planningMonthLabel } from '../features/finance/planningMonth';
import { financeService } from '../features/finance/financeService';
import { eurosInputToCents, formatCents, isoDate } from '../features/finance/money';
import { useHousehold } from '../features/households/useHousehold';
import { todayIso } from './expensePageUtils';

const formatBalanceInput = (cents) => ((cents ?? 0) / 100).toFixed(2).replace('.', ',');

function MonthPlanning({ currentHousehold, month }) {
  const householdId = currentHousehold.id;
  const mountedRef = useRef(true);
  const calculationDate = `${month}-01`;
  const [balance, setBalance] = useState('');
  const [personalBalances, setPersonalBalances] = useState({});
  const [correctionActive, setCorrectionActive] = useState(false);
  const [extraActive, setExtraActive] = useState(false);
  const queryClient = useQueryClient();
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  function refresh(queryKey) {
    return queryClient.invalidateQueries({ queryKey, ...(mountedRef.current ? {} : { refetchType: 'none' }) });
  }
  const dashboard = useQuery({
    queryKey: ['dashboard', householdId, 'planning', month],
    queryFn: () => financeService.dashboard(householdId, calculationDate),
    enabled: Boolean(householdId),
  });
  const prepare = useMutation({
    mutationFn: financeService.prepareMonth,
    onSuccess: () => {
      refresh(['dashboard', householdId]);
      refresh(['plannings', householdId]);
      if (mountedRef.current) toast.success('Previsión del mes guardada. Sus aportaciones quedan fijadas.');
    },
  });
  const fund = useMutation({
    mutationFn: financeService.fundPlanning,
    onSuccess: () => {
      refresh(['dashboard', householdId]);
      refresh(['plannings', householdId]);
      refresh(['monthlyPlanning', householdId]);
      if (mountedRef.current) toast.success('Aportación confirmada. No se ha movido dinero ni modificado el saldo bancario.');
    },
    onError: (error) => { if (error.status === 409) refresh(['dashboard', householdId]); },
  });
  const closeRecovery = useMutation({
    mutationFn: financeService.updateRecovery,
    onSuccess: () => {
      refresh(['dashboard', householdId]);
      if (mountedRef.current) toast.success('Plan de recuperación actualizado.');
    },
  });

  useEffect(() => {
    if (!dashboard.data) return;
    const data = dashboard.data;
    setBalance((current) => current || formatBalanceInput(data.balanceCents));
    setPersonalBalances((current) => {
      const next = { ...current };
      (data.budget.contributions ?? []).forEach((person) => {
        if (Object.hasOwn(next, person.personId)) return;
        const savedBalance = data.accountSummary?.personal?.find(
          (item) => item.personId === person.personId,
        )?.balanceCents;
        next[person.personId] = formatBalanceInput(savedBalance);
      });
      return next;
    });
  }, [dashboard.data]);

  if (dashboard.isPending) return <LoadingState />;
  if (dashboard.isError) return <ErrorState description={dashboard.error.message} onRetry={dashboard.refetch} />;

  const data = dashboard.data;
  const currentPlanning = data.planning;
  const displayedPlanning = currentPlanning;
  const people = data.budget.contributions ?? [];
  const currency = currentHousehold.currency;
  const activeAdjustmentCents = data.activeRecoveryPlan?.monthlyAdjustmentCents ?? 0;
  const expectedTotalCents = data.budget.recommendedBudgetCents + activeAdjustmentCents;

  return (
    <div className="space-y-8">
      {displayedPlanning?.personalHistoryRequiresConfirmation ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950" role="status">Esta preparación antigua no guardaba la identidad vinculada a cada persona. Sus datos originales se conservan, pero por privacidad no mostramos su desglose ni sus saldos personales históricos. <Link className="inline-flex min-h-11 items-center font-bold underline focus-visible:outline-2 focus-visible:outline-focus" to="/cuentas">Actualiza tu saldo en Cuentas</Link>. El presupuesto actual sigue calculándose con tus gastos y compras.</p> : null}

      {!data.budget.readiness.ready ? (
        <EmptyState
          action={<Link className="font-bold text-brand-strong" to="/hogar">Completar reparto</Link>}
          description="Necesitamos al menos una persona activa y porcentajes que sumen el 100 %."
          icon={ChartNoAxesCombined}
          title="El presupuesto aún no está listo"
        />
      ) : currentPlanning ? (
        <section className="min-w-0 rounded-2xl border border-border bg-surface p-4" aria-labelledby="saldos-confirmados">
          <h2 className="flex items-center gap-2 text-sm font-bold text-brand-strong" id="saldos-confirmados">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            Previsión del mes guardada
          </h2>
          {currentPlanning.revision > 0 ? <p className="mt-1 text-xs text-text-muted">Revisión {currentPlanning.revision}</p> : null}
          <p className="mt-1 text-sm leading-6 text-text-muted" role="status">
            {currentPlanning.budgetChangedSincePreparation ? 'Hay cambios en los gastos; tus aportaciones guardadas se mantienen.' : 'Tus aportaciones guardadas se mantienen.'}
          </p>
          {currentPlanning.budgetChangedSincePreparation ? <details className="mt-2 border-t border-border">
            <summary className="min-h-11 cursor-pointer content-center py-2 text-sm font-bold text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Ver cambios</summary>
            <div className="space-y-2 pt-1 text-sm leading-6 text-text-muted">
              <p>El presupuesto ha cambiado desde que guardaste esta previsión. {currentPlanning.revision > 0 ? 'Conservamos las aportaciones de la revisión guardada.' : 'Conservamos las aportaciones originales.'} Estas diferencias son para revisar, no nuevas transferencias confirmadas.</p>
              {currentPlanning.budgetComparison ? <>
                <p>Diferencia conjunta: {formatCents(currentPlanning.budgetComparison.householdDifferenceCents, currency)}. Diferencia personal: {currentPlanning.budgetComparison.personalDifferenceCents === null ? 'histórico no disponible' : formatCents(currentPlanning.budgetComparison.personalDifferenceCents, currency)}.</p>
                {currentPlanning.extraFunding?.agreedCents > 0 ? <p>Los extras ya acordados aparecen aparte. Esta diferencia compara presupuestos, no indica lo que queda por transferir.</p> : null}
                <ul className="mt-2 space-y-1">{currentPlanning.budgetComparison.lines.map((line) => <li className="break-words" key={line.id}>{line.name}: {formatCents(line.previousCents, currency)} → {formatCents(line.currentCents, currency)}</li>)}</ul>
              </> : null}
            </div>
          </details> : null}
        </section>
      ) : (
        <section className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-7" aria-labelledby="confirmar-saldos">
          <h2 className="text-lg font-bold" id="confirmar-saldos">Preparar las transferencias de {planningMonthLabel(month)}</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Revisa la previsión del día 1 al último día del mes que vas a financiar. Guarda el cálculo antes de confirmar las transferencias. No se consulta tu banco ni se mueve dinero.
          </p>
          <p className="mt-2 text-sm leading-6 text-text-muted">Los saldos se registran como referencia de cobertura: no se descuentan automáticamente de esta aportación, porque pueden estar reservados para otros pagos o para el colchón. Las medias variables usan meses terminados; cuando faltan 3 días o menos para acabar el mes, también incluyen su gasto registrado como cierre estimado para preparar el siguiente.</p>
          <dl className="mt-5 grid gap-3 rounded-2xl bg-surface-muted p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold text-text-muted">Previsión conjunta y tus gastos personales</dt>
              <dd className="mt-1 font-extrabold">{formatCents(data.budget.recommendedBudgetCents, currency)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-muted">Ajuste temporal</dt>
              <dd className="mt-1 font-extrabold">{formatCents(activeAdjustmentCents, currency)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-muted">Total calculado</dt>
              <dd className="mt-1 font-extrabold">{formatCents(expectedTotalCents, currency)}</dd>
            </div>
          </dl>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {people.map((person) => <article className="min-w-0 rounded-2xl bg-surface-muted p-4" key={person.personId}>
              <h3 className="break-words font-bold">{person.personName}</h3>
              <ContributionBreakdown currency={currency} householdCents={person.standardHouseholdCents} personalCents={person.personalExpenseCents} personalAmountsHidden={person.personalAmountsHidden} totalCents={person.totalStandardCents} totalLabel="Previsión antes de guardar" pendingAdjustment={activeAdjustmentCents > 0} />
            </article>)}
          </div>
          <form
            className="mt-6 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                prepare.mutate({
                  householdId,
                  body: {
                    calculationDate,
                    confirmedBalanceCents: eurosInputToCents(balance),
                    confirmedPersonalBalances: people.map((person) => ({
                      personId: person.personId,
                      balanceCents: eurosInputToCents(personalBalances[person.personId] ?? ''),
                    })),
                  },
                });
              } catch (error) {
                toast.error(error.message);
              }
            }}
          >
            <div>
              <label className="text-sm font-bold" htmlFor="planning-balance">Saldo de la cuenta conjunta</label>
              <input className="mt-2 min-h-12 w-full rounded-xl border border-border-strong px-3" id="planning-balance" inputMode="decimal" onChange={(event) => setBalance(event.target.value)} required value={balance} />
            </div>
            {people.map((person) => (
              <div key={person.personId}>
                <label className="text-sm font-bold" htmlFor={`planning-balance-${person.personId}`}>
                  Saldo personal de {person.personName}
                </label>
                <input
                  className="mt-2 min-h-12 w-full rounded-xl border border-border-strong px-3"
                  id={`planning-balance-${person.personId}`}
                  inputMode="decimal"
                  onChange={(event) => setPersonalBalances((current) => ({ ...current, [person.personId]: event.target.value }))}
                  required
                  value={personalBalances[person.personId] ?? ''}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <button className="min-h-12 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60" disabled={prepare.isPending} type="submit">
                {prepare.isPending ? 'Guardando…' : 'Guardar previsión del mes'}
              </button>
            </div>
            {prepare.isError ? <p className="text-sm text-red-700 sm:col-span-2" role="alert">{prepare.error.message}</p> : null}
          </form>
        </section>
      )}

      {displayedPlanning ? (
        <section aria-labelledby="ultima-planificacion">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-6 text-brand" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-bold" id="ultima-planificacion">Transferencias del mes seleccionado</h2>
              <p className="text-sm text-text-muted">{displayedPlanning.month}/{displayedPlanning.year} · cálculo {isoDate(displayedPlanning.calculationDate)}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {displayedPlanning.contributions.map((item) => (
              <article
                aria-label={`Aportación preparada de ${item.personName}`}
                className="min-w-0 rounded-2xl border border-border bg-surface p-5"
                key={item.id}
              >
                <p className="break-words font-bold">{item.personName}</p>
                <ContributionBreakdown
                  adjustmentCents={item.temporaryAdjustmentCents}
                  currency={currency}
                  householdCents={item.standardHouseholdCents}
                  personalCents={item.personalExpenseCents}
                  personalAmountsHidden={item.personalAmountsHidden}
                  totalCents={item.totalRecommendedCents}
                  totalLabel="Aportación prevista guardada"
                />
                <dl className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                  {item.extraFunding?.agreedCents > 0 ? <div className="flex flex-wrap justify-between gap-2"><dt>Extra conjunto acordado</dt><dd className="font-bold">{formatCents(item.extraFunding.agreedCents, currency)}</dd></div> : null}
                  <div className="flex flex-wrap justify-between gap-2"><dt>{item.personalAmountsHidden ? 'Confirmado conjunto' : 'Ya confirmado'}</dt><dd className="font-bold">{formatCents(item.totalConfirmedCents ?? item.funding?.confirmedCents ?? (displayedPlanning.fundingStatus === 'FUNDED' ? item.totalRecommendedCents : 0), currency)}</dd></div>
                  <div className="flex flex-wrap justify-between gap-2"><dt>{item.personalAmountsHidden ? 'Pendiente conjunto' : 'Pendiente de aportar'}</dt><dd className="font-extrabold">{formatCents(item.totalPendingCents ?? item.funding?.pendingCents ?? (displayedPlanning.fundingStatus === 'FUNDED' ? 0 : item.totalRecommendedCents), currency)}</dd></div>
                </dl>
                {item.canConfirmPersonal && item.personalExpenseCents > 0 && !item.funding?.personalConfirmed ? <button className="mt-4 min-h-11 rounded-xl border border-border-strong px-4 text-sm font-bold text-brand-strong disabled:opacity-60" disabled={fund.isPending || correctionActive || extraActive} onClick={() => fund.mutate({ householdId, planningId: displayedPlanning.id, scope: 'PERSONAL', ...(displayedPlanning.stateVersion === undefined ? {} : { expectedVersion: displayedPlanning.stateVersion }) })} type="button">Confirmar mi aportación personal realizada</button> : null}
              </article>
            ))}
          </div>
          {displayedPlanning.fundingStatus === 'PREPARED' && displayedPlanning.contributions.some((item) => !item.funding?.commonConfirmed && item.standardHouseholdCents + item.temporaryAdjustmentCents > 0) ? (
            <button
              className="mt-4 min-h-11 rounded-xl bg-brand px-4 font-bold text-on-brand disabled:opacity-60"
              disabled={fund.isPending || correctionActive || extraActive}
              onClick={() => fund.mutate({ householdId, planningId: displayedPlanning.id, scope: 'HOUSEHOLD', ...(displayedPlanning.stateVersion === undefined ? {} : { expectedVersion: displayedPlanning.stateVersion }) })}
              type="button"
            >
              Confirmar todas las transferencias conjuntas realizadas
            </button>
          ) : displayedPlanning.fundingStatus === 'FUNDED' ? (
            <p className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${displayedPlanning.extraFunding?.pendingCents > 0 ? 'bg-amber-50 text-amber-950' : 'bg-emerald-100 text-emerald-800'}`}>
              <CheckCircle2 className="size-4" aria-hidden="true" /> {displayedPlanning.extraFunding?.pendingCents > 0 ? 'Aportación inicial confirmada · Extras pendientes' : 'Fondos del mes confirmados'}
            </p>
          ) : <p className="mt-4 text-sm text-text-muted">Las transferencias conjuntas están cubiertas. Cada persona puede confirmar su aportación personal.</p>}
          {fund.isError ? <p className="mt-3 text-sm text-red-700" role="alert">{fund.error.message}</p> : null}
          <p className="mt-3 text-xs leading-5 text-text-muted">Esta confirmación registra solo la aportación prevista guardada, sin incluir extras. No hace transferencias ni suma otra vez ese dinero al saldo de las cuentas.</p>
          <PlanningExtras currency={currency} disabled={fund.isPending || correctionActive} householdId={householdId} planning={displayedPlanning} onOpenChange={setExtraActive} onStale={() => refresh(['dashboard', householdId])} onSaved={() => Promise.all([refresh(['dashboard', householdId]), refresh(['plannings', householdId]), refresh(['monthlyPlanning', householdId])])} />
          <PlanningCorrections currency={currency} disabled={fund.isPending || extraActive} householdId={householdId} planning={displayedPlanning} onOpenChange={setCorrectionActive} onStale={() => refresh(['dashboard', householdId])} onSaved={() => Promise.all([refresh(['dashboard', householdId]), refresh(['plannings', householdId]), refresh(['monthlyPlanning', householdId])])} />
        </section>
      ) : null}

      <PlanningBudgetDetails currency={currency} lines={displayedPlanning ? displayedPlanning.budgetLines : data.budget.lines} />

      {data.activeRecoveryPlan ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5" aria-labelledby="active-recovery">
          <h2 className="font-bold text-amber-950" id="active-recovery">Ajuste temporal activo</h2>
          <p className="mt-2 text-sm text-amber-900">
            Se repartirán {formatCents(data.activeRecoveryPlan.monthlyAdjustmentCents, currency)} adicionales al mes. Esto no modifica el presupuesto estándar.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand" disabled={closeRecovery.isPending} onClick={() => closeRecovery.mutate({ householdId, recoveryPlanId: data.activeRecoveryPlan.id, status: 'COMPLETED' })} type="button">Marcar como recuperado</button>
            <button className="min-h-11 rounded-xl border border-amber-400 px-4 text-sm font-bold text-amber-950" disabled={closeRecovery.isPending} onClick={() => closeRecovery.mutate({ householdId, recoveryPlanId: data.activeRecoveryPlan.id, status: 'CANCELLED' })} type="button">Cancelar ajuste</button>
          </div>
        </section>
      ) : null}

      <Link className="inline-flex min-h-12 items-center rounded-xl border border-border-strong px-5 py-3 text-sm font-bold text-brand-strong hover:bg-brand-soft" to="/simulador">
        Simular otra fecha o una recuperación
      </Link>
    </div>
  );
}

function HouseholdPlanning({ currentHousehold }) {
  const [params] = useSearchParams();
  const [month, setMonth] = useState(() => isPlanningMonth(params.get('mes') ?? '') ? params.get('mes') : nextPlanningMonth(todayIso()));
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  return <div className="space-y-6">
    <PageHeader title="Planificación mensual" />
    <section className="rounded-2xl border border-border bg-surface p-5">
      <label className="block text-sm font-bold" htmlFor="planning-month">Mes a financiar</label>
      <input className="mt-2 min-h-12 max-w-full rounded-xl border border-border-strong px-3" id="planning-month" max="2200-12" min="2000-01" onChange={(event) => { if (isPlanningMonth(event.target.value)) setMonth(event.target.value); }} type="month" value={month} />
      <p className="mt-3 text-sm leading-6 text-text-muted">Previsión de {planningMonthLabel(month)}, del día 1 al {lastDay}. El sueldo cobrado a final del mes anterior financia este mes completo.</p>
      <p className="mt-1 text-sm leading-6 text-text-muted">Cambiar el mes solo consulta otra previsión: no confirma ni modifica transferencias.</p>
    </section>
    <MonthPlanning currentHousehold={currentHousehold} key={month} month={month} />
  </div>;
}

export function PlanningPage() {
  const { currentHousehold, isPending } = useHousehold();
  if (isPending) return <LoadingState />;
  if (!currentHousehold?.id) {
    return <EmptyState action={<Link className="font-bold text-brand-strong" to="/hogar">Crear hogar</Link>} description="Configura primero las personas que participan en el presupuesto." icon={ChartNoAxesCombined} title="Todavía no hay un hogar" />;
  }
  // A household switch must discard balances, dates and mutation state from
  // the previous household before any new planning can be submitted.
  return <HouseholdPlanning currentHousehold={currentHousehold} key={currentHousehold.id} />;
}
