import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Gauge, ShieldAlert, TriangleAlert, WalletCards } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { financeService } from '../features/finance/financeService';
import { eurosInputToCents, formatCents, isoDate } from '../features/finance/money';
import { useHousehold } from '../features/households/useHousehold';

const today = () => new Date().toISOString().slice(0, 10);

const financialStatus = Object.freeze({
  ATTENTION: {
    description: 'La reserva queda muy cerca del saldo disponible. Conviene vigilar los próximos vencimientos.',
    label: 'Atención: margen ajustado',
  },
  DEFICIT: {
    description: 'La reserva teórica supera el saldo simulado. La recuperación puede repartirse en varios meses.',
    label: 'Déficit estimado',
  },
  OK: {
    description: 'El saldo simulado cubre la reserva teórica y no hay un próximo pago por encima del saldo disponible.',
    label: 'Previsión estable',
  },
  PAYMENT_RISK: {
    description: 'El próximo pago común supera el saldo simulado. Revisa el vencimiento y prepara una aportación a tiempo.',
    label: 'Riesgo de próximo pago',
  },
});

function remainingDaysLabel(daysRemaining, overdue = false) {
  if (overdue) return 'Vencimiento superado';
  if (!Number.isInteger(daysRemaining)) return 'Días restantes no disponibles';
  if (daysRemaining === 0) return 'Vence hoy';
  if (daysRemaining === 1) return 'Queda 1 día';
  return `Quedan ${daysRemaining} días`;
}

export function SimulatorPage() {
  const { currentHousehold, isPending: householdPending } = useHousehold();
  const householdId = currentHousehold?.id;
  const [date, setDate] = useState(today);
  const [appliedDate, setAppliedDate] = useState(today);
  const [balance, setBalance] = useState('');
  const [appliedBalance, setAppliedBalance] = useState(undefined);
  const [mode, setMode] = useState('RECOMMENDED');
  const [modeValue, setModeValue] = useState('');
  const queryClient = useQueryClient();
  const simulation = useQuery({
    queryKey: ['simulation', householdId, appliedDate, appliedBalance],
    queryFn: () => financeService.simulation(householdId, appliedDate, appliedBalance),
    enabled: Boolean(householdId),
  });
  const createRecovery = useMutation({
    mutationFn: financeService.createRecovery,
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', householdId] });
      queryClient.invalidateQueries({ queryKey: ['plannings', householdId] });
      toast.success(
        `Ajuste temporal activado: ${formatCents(plan.monthlyAdjustmentCents, currentHousehold?.currency)} al mes.`,
      );
    },
  });

  if (householdPending) return <LoadingState />;
  if (!householdId) {
    return <EmptyState action={<Link className="font-bold text-brand-strong" to="/hogar">Crear hogar</Link>} description="El simulador necesita los gastos y el saldo de un hogar." icon={Gauge} title="No hay hogar seleccionado" />;
  }
  if (simulation.isPending) return <LoadingState label="Simulando fecha" />;
  if (simulation.isError) return <ErrorState description={simulation.error.message} onRetry={simulation.refetch} />;

  const data = simulation.data;
  if (!data.readiness.ready) {
    return <EmptyState action={<Link className="font-bold text-brand-strong" to="/hogar">Completar reparto</Link>} description="Completa las personas activas antes de simular." icon={Gauge} title="Presupuesto no disponible" />;
  }
  const currency = currentHousehold.currency;
  const status = financialStatus[data.financialStatus] ?? {
    description: 'El servidor no ha podido clasificar esta previsión.',
    label: 'Estado no disponible',
  };
  const upcomingPayments = data.upcomingPayments ?? [];
  const reserveLines = data.reserveLines ?? [];
  const immediateContributionCents = data.deficitCents;
  const totalWithImmediateContributionCents =
    data.monthlyStandardBudgetCents + immediateContributionCents;
  const balanceAfterImmediateContributionCents =
    data.relevantAvailableBalanceCents + immediateContributionCents;
  const recoveryBody = () => ({
    deficitCents: data.deficitCents,
    mode,
    startsOn: appliedDate,
    ...(mode === 'MAX_MONTHLY' ? { maximumMonthlyCents: eurosInputToCents(modeValue) } : {}),
  });

  function activateMonthlyAdjustment() {
    try {
      createRecovery.mutate({ householdId, body: recoveryBody() });
    } catch (error) {
      toast.error(error.message);
    }
  }

  function adjustThisMonth() {
    createRecovery.mutate({
      householdId,
      body: {
        deficitCents: data.deficitCents,
        mode: 'TARGET_MONTHS',
        startsOn: appliedDate,
        targetMonths: 1,
      },
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Simulador financiero" />
      <form
        className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            setAppliedBalance(balance ? eurosInputToCents(balance) : undefined);
            setAppliedDate(date);
          } catch (error) {
            toast.error(error.message);
          }
        }}
      >
        <div>
          <label className="text-sm font-bold" htmlFor="simulation-date">Fecha a simular</label>
          <input className="mt-2 min-h-12 w-full rounded-xl border border-border-strong px-3" id="simulation-date" onChange={(event) => setDate(event.target.value)} required type="date" value={date} />
        </div>
        <div>
          <label className="text-sm font-bold" htmlFor="simulation-balance">Saldo alternativo (opcional)</label>
          <input className="mt-2 min-h-12 w-full rounded-xl border border-border-strong px-3" id="simulation-balance" inputMode="decimal" onChange={(event) => setBalance(event.target.value)} value={balance} />
        </div>
        <button className="min-h-12 rounded-xl bg-brand px-5 font-bold text-on-brand sm:col-span-2 sm:justify-self-start" type="submit">Actualizar simulación</button>
      </form>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resultado de la simulación">
        <article className="rounded-2xl border border-border bg-surface p-5"><p className="text-sm text-text-muted">Estándar mensual</p><p className="mt-2 text-2xl font-extrabold">{formatCents(data.monthlyStandardBudgetCents, currency)}</p></article>
        <article className="rounded-2xl border border-border bg-surface p-5"><p className="text-sm text-text-muted">Reserva a esa fecha</p><p className="mt-2 text-2xl font-extrabold">{formatCents(data.theoreticalReserveCents, currency)}</p></article>
        <article className={`rounded-2xl p-5 ${data.deficitCents ? 'bg-red-950 text-white' : 'bg-brand-deep text-on-brand'}`}><p className="text-sm opacity-80">Déficit</p><p className="mt-2 text-2xl font-extrabold">{formatCents(data.deficitCents, currency)}</p></article>
      </section>

      <section
        aria-labelledby="simulation-forecast"
        className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
            <ShieldAlert aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-text-soft">Riesgo y previsión</p>
            <h2 className="mt-1 text-lg font-extrabold" id="simulation-forecast">{status.label}</h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">{status.description}</p>
          </div>
        </div>
        <div className="mt-4">
          <StatusBadge>Estado API: {data.financialStatus}</StatusBadge>
        </div>
      </section>

      <section aria-labelledby="simulation-payments">
        <div className="flex items-center gap-3">
          <CalendarClock aria-hidden="true" className="size-6 text-brand-strong" />
          <div>
            <h2 className="text-lg font-bold" id="simulation-payments">Próximos pagos</h2>
            <p className="text-sm text-text-muted">Vencimientos calculados para la fecha simulada.</p>
          </div>
        </div>
        {upcomingPayments.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {upcomingPayments.map((payment) => (
              <li className="rounded-2xl border border-border bg-surface p-4" key={payment.expenseId}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{payment.name}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {isoDate(payment.dueDate)} · {remainingDaysLabel(payment.daysRemaining)}
                    </p>
                  </div>
                  <p className="shrink-0 font-extrabold">{formatCents(payment.amountCents, currency)}</p>
                </div>
                <p className="mt-3 text-xs font-semibold text-text-soft">
                  {payment.scope === 'PERSONAL' ? 'Gasto personal' : 'Gasto común'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl bg-surface-muted p-4 text-sm text-text-muted">No hay pagos futuros desde esta fecha.</p>
        )}
      </section>

      <section aria-labelledby="simulation-reserve-lines">
        <div className="flex items-center gap-3">
          <WalletCards aria-hidden="true" className="size-6 text-brand-strong" />
          <div>
            <h2 className="text-lg font-bold" id="simulation-reserve-lines">Desglose de la reserva teórica</h2>
            <p className="text-sm text-text-muted">Importe acumulado dentro del ciclo de cada gasto periódico común.</p>
          </div>
        </div>
        {reserveLines.length ? (
          <ul className="mt-4 space-y-3">
            {reserveLines.map((line) => (
              <li className="rounded-2xl border border-border bg-surface p-4" key={line.expenseId}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold">{line.name}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      Vence {isoDate(line.dueDate)} · {remainingDaysLabel(line.daysRemaining, line.overdue)}
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm sm:text-right">
                    <div>
                      <dt className="text-xs text-text-muted">Reservado a fecha</dt>
                      <dd className="font-extrabold">{formatCents(line.reserveCents, currency)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">Objetivo</dt>
                      <dd className="font-extrabold">{formatCents(line.targetAmountCents, currency)}</dd>
                    </div>
                  </dl>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl bg-surface-muted p-4 text-sm text-text-muted">No hay gastos periódicos que generen reserva teórica en esta fecha.</p>
        )}
      </section>

      {data.deficitCents > 0 ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-5 sm:p-7" aria-labelledby="recovery-title">
          <TriangleAlert className="size-6 text-red-700" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold text-red-950" id="recovery-title">Recuperar sin aportarlo todo de golpe</h2>
          <article className="mt-5 rounded-2xl border border-red-200 bg-white p-5 text-red-950" aria-labelledby="immediate-contribution-title">
            <h3 className="text-base font-extrabold" id="immediate-contribution-title">Si lo aportáis hoy</h3>
            <p className="mt-1 text-sm leading-6 text-red-900">
              Una aportación extraordinaria cubriría el déficit de esta simulación de una vez.
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-red-50 p-3">
                <dt className="text-xs font-semibold text-red-900">Aporte extraordinario hoy</dt>
                <dd className="mt-1 text-lg font-extrabold">{formatCents(immediateContributionCents, currency)}</dd>
              </div>
              <div className="rounded-xl bg-red-50 p-3">
                <dt className="text-xs font-semibold text-red-900">Total a aportar este mes</dt>
                <dd className="mt-1 text-lg font-extrabold">{formatCents(totalWithImmediateContributionCents, currency)}</dd>
              </div>
              <div className="rounded-xl bg-red-50 p-3">
                <dt className="text-xs font-semibold text-red-900">Saldo después del aporte</dt>
                <dd className="mt-1 text-lg font-extrabold">{formatCents(balanceAfterImmediateContributionCents, currency)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-5 text-red-900">
              Este cálculo es informativo: no crea ni registra una aportación.
            </p>
          </article>
          <div className="mt-6">
            <h3 className="text-base font-extrabold text-red-950">Aplicar un ajuste temporal</h3>
            <p className="mt-1 text-sm leading-6 text-red-900">
              Elige la cuota mensual y aplícala directamente. Se incluirá al preparar el mes, sin cambiar el presupuesto estándar.
            </p>
          </div>
          <fieldset className="mt-5">
            <legend className="text-sm font-bold text-red-950">Importe mensual</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-red-300 bg-white px-3.5 py-2.5 text-sm font-semibold has-[:checked]:border-red-800 has-[:checked]:bg-red-100">
                <input
                  checked={mode === 'RECOMMENDED'}
                  className="size-4 accent-red-800"
                  name="recovery-mode"
                  onChange={() => {
                    setMode('RECOMMENDED');
                    setModeValue('');
                  }}
                  type="radio"
                />
                Usar la recomendación
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-red-300 bg-white px-3.5 py-2.5 text-sm font-semibold has-[:checked]:border-red-800 has-[:checked]:bg-red-100">
                <input
                  checked={mode === 'MAX_MONTHLY'}
                  className="size-4 accent-red-800"
                  name="recovery-mode"
                  onChange={() => setMode('MAX_MONTHLY')}
                  type="radio"
                />
                Elegir mi importe mensual
              </label>
            </div>
          </fieldset>
          {mode === 'MAX_MONTHLY' ? (
            <div className="mt-4 max-w-sm">
              <label className="text-sm font-bold text-red-950" htmlFor="recovery-value">Ajuste mensual (€)</label>
              <input
                className="mt-2 min-h-12 w-full rounded-xl border border-red-300 bg-white px-3"
                id="recovery-value"
                inputMode="decimal"
                min="0,01"
                onChange={(event) => setModeValue(event.target.value)}
                placeholder="0,00"
                value={modeValue}
              />
            </div>
          ) : null}
          <div className="mt-5 flex flex-col gap-2 min-[430px]:flex-row">
            <button
              className="min-h-12 rounded-xl bg-red-900 px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={createRecovery.isPending}
              onClick={activateMonthlyAdjustment}
              type="button"
            >
              {createRecovery.isPending ? 'Aplicando ajuste…' : 'Aplicar ajuste mensual'}
            </button>
            <button
              className="min-h-12 rounded-xl border border-red-300 bg-white px-5 font-bold text-red-950 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={createRecovery.isPending}
              onClick={adjustThisMonth}
              type="button"
            >
              Ajustar todo este mes
            </button>
          </div>
          {createRecovery.isError ? <p className="mt-3 text-sm text-red-800" role="alert">{createRecovery.error.message}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
