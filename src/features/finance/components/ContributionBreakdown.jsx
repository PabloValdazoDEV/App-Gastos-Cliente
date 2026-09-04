import { formatCents } from '../money';

export function ContributionBreakdown({
  adjustmentCents = 0,
  currency,
  contributionBps,
  householdCents,
  inverted = false,
  pendingAdjustment = false,
  personalCents = 0,
  totalCents,
}) {
  const resolvedHousehold = Number.isSafeInteger(householdCents) ? householdCents : 0;
  const resolvedPersonal = Number.isSafeInteger(personalCents) ? personalCents : 0;
  const resolvedTotal = Number.isSafeInteger(totalCents)
    ? totalCents
    : Number.isSafeInteger(adjustmentCents)
      ? resolvedHousehold + resolvedPersonal + adjustmentCents
      : null;
  const labelClass = inverted ? 'text-on-brand-muted' : 'text-text-muted';
  const valueClass = inverted ? 'text-on-brand' : 'text-text';

  return (
    <dl className="mt-3 space-y-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <dt className={labelClass}>
          Aportación conjunta
          {Number.isInteger(contributionBps) ? ` (${contributionBps / 100} %)` : ''}
        </dt>
        <dd className={`font-bold ${valueClass}`}>
          {formatCents(resolvedHousehold, currency)}
        </dd>
      </div>
      <div className="flex items-start justify-between gap-3">
        <dt className={labelClass}>Gastos personales</dt>
        <dd className={`font-bold ${valueClass}`}>
          {formatCents(resolvedPersonal, currency)}
        </dd>
      </div>
      <div className="flex items-start justify-between gap-3">
        <dt className={labelClass}>Ajuste conjunto</dt>
        <dd className={`text-right font-bold ${valueClass}`}>
          {pendingAdjustment
            ? 'Pendiente de repartir'
            : formatCents(adjustmentCents, currency)}
        </dd>
      </div>
      <div
        className={`flex items-start justify-between gap-3 border-t pt-2 ${
          inverted ? 'border-on-brand/15' : 'border-border'
        }`}
      >
        <dt className={`font-bold ${valueClass}`}>Total a aportar</dt>
        <dd className={`text-right font-extrabold ${valueClass}`}>
          {pendingAdjustment ? 'Se confirma al preparar' : formatCents(resolvedTotal, currency)}
        </dd>
      </div>
    </dl>
  );
}
