import { useId } from 'react';

import { StatusBadge } from '../../../components/ui/StatusBadge';
import { formatCents } from '../money';

const statusLabels = {
  WITHIN_BUDGET: 'En presupuesto',
  NEAR_LIMIT: 'Cerca del límite',
  OVER_BUDGET: 'Presupuesto superado',
};

export function MonthlyBudgetProgress({ currency, estimated = false, primary = false, progress, title }) {
  const titleId = useId();
  const descriptionId = useId();
  const percentage = progress.progressBps === null ? null : progress.progressBps / 100;
  const percentageText = percentage === null ? null : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(percentage);
  const overBudget = progress.overBudgetCents > 0;
  const labelClass = primary ? 'text-on-brand-muted' : 'text-text-muted';
  const valueClass = primary ? 'text-on-brand' : 'text-text';

  return (
    <section aria-labelledby={titleId} className={`min-w-0 rounded-3xl p-5 sm:p-7 ${primary ? 'bg-brand-deep text-on-brand shadow-elevated' : 'border border-border bg-surface text-text shadow-card'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className={`min-w-0 text-sm font-bold ${labelClass}`} id={titleId}>{title}</h2>
        <StatusBadge>{statusLabels[progress.status] ?? 'En presupuesto'}</StatusBadge>
      </div>
      <p className={`mt-4 break-words font-extrabold ${primary ? 'text-2xl sm:text-3xl' : 'text-xl'}`}>
        {overBudget ? 'Has superado el presupuesto en' : 'Te quedan'}
        <span className={`mt-1 block break-words tracking-tight ${primary ? 'text-3xl sm:text-5xl' : 'text-2xl'}`}>{formatCents(overBudget ? progress.overBudgetCents : progress.remainingCents, currency)}</span>
      </p>
      <p className={`mt-2 text-sm leading-6 ${labelClass}`}>de {formatCents(progress.budgetCents, currency)} de presupuesto este mes{estimated ? ' · Presupuesto estimado' : ''}</p>
      <dl className={`mt-5 grid min-w-0 gap-4 border-t pt-5 sm:grid-cols-3 ${primary ? 'border-on-brand/15' : 'border-border'}`}>
        {[
          ['Presupuesto del mes', progress.budgetCents],
          ['Utilizado', progress.usedCents],
          ['Presupuesto restante', progress.remainingCents],
        ].map(([label, cents]) => (
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 sm:block" key={label}>
            <dt className={`text-xs font-semibold ${labelClass}`}>{label}</dt>
            <dd className={`mt-1 break-words text-lg font-extrabold ${valueClass}`}>{formatCents(cents, currency)}</dd>
          </div>
        ))}
      </dl>
      <p className={`mt-5 text-sm font-semibold ${labelClass}`} id={descriptionId}>{percentageText === null ? 'Gasto registrado sin presupuesto asignado; no se puede calcular un porcentaje.' : `${percentageText} % utilizado`}</p>
      {percentage !== null ? (
        <div
          aria-describedby={descriptionId}
          aria-label={`Utilización: ${title}`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.min(100, percentage)}
          aria-valuetext={`${percentageText} % utilizado: ${formatCents(progress.usedCents, currency)} de ${formatCents(progress.budgetCents, currency)}${overBudget ? `; presupuesto superado en ${formatCents(progress.overBudgetCents, currency)}` : ''}`}
          className={`mt-2 h-2.5 rounded-full ${primary ? 'bg-on-brand/20' : 'bg-surface-muted'}`}
          role="progressbar"
        >
          <div className={`h-full rounded-full ${primary ? 'bg-on-brand' : 'bg-brand'}`} style={{ width: `${Math.min(100, percentage)}%` }} />
        </div>
      ) : null}
      <p className={`mt-3 text-xs leading-5 ${labelClass}`}>El presupuesto incluye los márgenes configurados. Utilizado refleja importes reales registrados.</p>
    </section>
  );
}

export function CashCoverage({ coverage, currency, title }) {
  const titleId = useId();
  const isShortfall = coverage?.status === 'SHORTFALL';
  return (
    <section aria-labelledby={titleId} className="min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 font-bold" id={titleId}>{title}</h2>
        {coverage ? <StatusBadge>{isShortfall ? 'Falta saldo' : 'Cubierto'}</StatusBadge> : null}
      </div>
      <p className="mt-1 text-xs text-text-muted">Según los saldos registrados</p>
      {!coverage ? <p className="mt-4 text-sm text-text-muted">Saldo personal sin registrar. Añádelo en Cuentas para comprobar su cobertura.</p> : (
        <>
          <dl className="mt-5 grid min-w-0 gap-4 sm:grid-cols-3">
            {[
              ['Saldo actual', coverage.balanceCents],
              ['Presupuesto restante', coverage.remainingBudgetCents],
              [isShortfall ? 'Pendiente por cubrir' : 'Colchón', isShortfall ? coverage.shortfallCents : coverage.cushionCents],
            ].map(([label, cents]) => (
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 sm:block" key={label}>
                <dt className="text-xs font-semibold text-text-muted">{label}</dt>
                <dd className="mt-1 break-words text-xl font-extrabold">{formatCents(cents, currency)}</dd>
              </div>
            ))}
          </dl>
          <p className={`mt-5 break-words font-bold ${isShortfall ? 'text-amber-900' : 'text-brand-strong'}`}>{isShortfall ? `Faltan ${formatCents(coverage.shortfallCents, currency)} para cubrir el presupuesto restante` : 'El saldo cubre el presupuesto restante'}</p>
          {!isShortfall ? <p className="mt-1 text-sm text-text-muted">Colchón sobre lo presupuestado: {formatCents(coverage.cushionCents, currency)}.</p> : null}
          <p className="mt-3 text-xs leading-5 text-text-muted">Es la diferencia entre el saldo registrado y el presupuesto que todavía queda del mes. No incluye gastos que aún no hayas registrado.</p>
          {coverage.balanceSource === 'MONTHLY_PLANNING' ? <p className="mt-2 text-xs leading-5 text-text-muted">Se utiliza el saldo confirmado al preparar el mes; revísalo si ha cambiado.</p> : null}
        </>
      )}
    </section>
  );
}
