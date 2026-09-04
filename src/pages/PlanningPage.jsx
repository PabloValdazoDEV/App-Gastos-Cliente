import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChartNoAxesCombined, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { ContributionBreakdown } from '../features/finance/components/ContributionBreakdown';
import { financeService } from '../features/finance/financeService';
import { eurosInputToCents, formatCents, isoDate } from '../features/finance/money';
import { useHousehold } from '../features/households/useHousehold';

const today = () => new Date().toISOString().slice(0, 10);
const formatBalanceInput = (cents) => ((cents ?? 0) / 100).toFixed(2).replace('.', ',');

export function PlanningPage() {
  const { currentHousehold, isPending: householdPending } = useHousehold();
  const householdId = currentHousehold?.id;
  const [calculationDate, setCalculationDate] = useState(today);
  const [balance, setBalance] = useState('');
  const [personalBalances, setPersonalBalances] = useState({});
  const queryClient = useQueryClient();
  const dashboard = useQuery({
    queryKey: ['dashboard', householdId, 'planning'],
    queryFn: () => financeService.dashboard(householdId),
    enabled: Boolean(householdId),
  });
  const plannings = useQuery({
    queryKey: ['plannings', householdId],
    queryFn: () => financeService.plannings(householdId),
    enabled: Boolean(householdId),
  });
  const prepare = useMutation({
    mutationFn: financeService.prepareMonth,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', householdId] });
      queryClient.invalidateQueries({ queryKey: ['plannings', householdId] });
      toast.success('Saldos del mes confirmados y cálculos actualizados.');
    },
  });
  const fund = useMutation({
    mutationFn: financeService.fundPlanning,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', householdId] });
      queryClient.invalidateQueries({ queryKey: ['plannings', householdId] });
      toast.success('Mes marcado como financiado.');
    },
  });
  const closeRecovery = useMutation({
    mutationFn: financeService.updateRecovery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', householdId] });
      toast.success('Plan de recuperación actualizado.');
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

  if (householdPending || (householdId && dashboard.isPending)) return <LoadingState />;
  if (!householdId) {
    return (
      <EmptyState
        action={<Link className="font-bold text-brand-strong" to="/hogar">Crear hogar</Link>}
        description="Configura primero las personas que participan en el presupuesto."
        icon={ChartNoAxesCombined}
        title="Todavía no hay un hogar"
      />
    );
  }
  if (dashboard.isError) return <ErrorState description={dashboard.error.message} onRetry={dashboard.refetch} />;

  const data = dashboard.data;
  const currentPlanning = data.planning;
  const latestPlanning = plannings.data?.[0];
  const displayedPlanning = currentPlanning ?? latestPlanning;
  const people = data.budget.contributions ?? [];
  const currency = currentHousehold.currency;
  const activeAdjustmentCents = data.activeRecoveryPlan?.monthlyAdjustmentCents ?? 0;
  const expectedTotalCents = data.budget.recommendedBudgetCents + activeAdjustmentCents;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Planificación mensual"
      />

      {!data.budget.readiness.ready ? (
        <EmptyState
          action={<Link className="font-bold text-brand-strong" to="/hogar">Completar reparto</Link>}
          description="Necesitamos al menos una persona activa y porcentajes que sumen el 100 %."
          icon={ChartNoAxesCombined}
          title="El presupuesto aún no está listo"
        />
      ) : currentPlanning ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-card sm:p-7" aria-labelledby="saldos-confirmados">
          <h2 className="text-lg font-bold text-emerald-950" id="saldos-confirmados">Este mes ya está calculado</h2>
          <p className="mt-2 text-sm leading-6 text-emerald-900">
            Ya hemos utilizado el saldo de la cuenta conjunta y los saldos personales para calcular las aportaciones y comprobar si las cuentas van bien.
          </p>
        </section>
      ) : (
        <section className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-7" aria-labelledby="confirmar-saldos">
          <h2 className="text-lg font-bold" id="confirmar-saldos">Confirmar saldos del mes</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            A principios de cada mes introduce el dinero disponible en la cuenta conjunta y en cada cuenta personal. Con esos saldos calcularemos las aportaciones, el margen y si cada cuenta va bien o está en números rojos.
          </p>
          <dl className="mt-5 grid gap-3 rounded-2xl bg-surface-muted p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold text-text-muted">Estándar mensual</dt>
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
              <label className="text-sm font-bold" htmlFor="planning-date">Fecha de cálculo</label>
              <input className="mt-2 min-h-12 w-full rounded-xl border border-border-strong px-3" id="planning-date" onChange={(event) => setCalculationDate(event.target.value)} required type="date" value={calculationDate} />
            </div>
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
                {prepare.isPending ? 'Calculando…' : 'Confirmar saldos y calcular mes'}
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
              <h2 className="text-lg font-bold" id="ultima-planificacion">{currentPlanning ? 'Saldos del mes confirmados' : 'Último mes preparado'}</h2>
              <p className="text-sm text-text-muted">{displayedPlanning.month}/{displayedPlanning.year} · cálculo {isoDate(displayedPlanning.calculationDate)}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {displayedPlanning.contributions.map((item) => (
              <article
                aria-label={`Aportación preparada de ${item.personName}`}
                className="rounded-2xl border border-border bg-surface p-5"
                key={item.id}
              >
                <p className="font-bold">{item.personName}</p>
                <ContributionBreakdown
                  adjustmentCents={item.temporaryAdjustmentCents}
                  currency={currency}
                  householdCents={item.standardHouseholdCents}
                  personalCents={item.personalExpenseCents}
                  totalCents={item.totalRecommendedCents}
                />
              </article>
            ))}
          </div>
          {displayedPlanning.fundingStatus === 'PREPARED' ? (
            <button
              className="mt-4 min-h-11 rounded-xl bg-brand px-4 font-bold text-on-brand disabled:opacity-60"
              disabled={fund.isPending}
              onClick={() => fund.mutate({ householdId, planningId: displayedPlanning.id })}
              type="button"
            >
              Confirmar fondos del mes
            </button>
          ) : (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-800">
              <CheckCircle2 className="size-4" aria-hidden="true" /> Fondos del mes confirmados
            </p>
          )}
        </section>
      ) : null}

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
