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
    <dl className="mt-3 min-w-0 space-y-2 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <dt className={`min-w-0 break-words ${labelClass}`}>
          Aportación conjunta
          {Number.isInteger(contributionBps) ? ` (${contributionBps / 100} %)` : ''}
        </dt>
        <dd className={`ml-auto min-w-0 max-w-full break-words text-right font-bold ${valueClass}`}>
          {formatCents(resolvedHousehold, currency)}
        </dd>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <dt className={`min-w-0 break-words ${labelClass}`}>Gastos personales</dt>
        <dd className={`ml-auto min-w-0 max-w-full break-words text-right font-bold ${valueClass}`}>
          {formatCents(resolvedPersonal, currency)}
        </dd>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <dt className={`min-w-0 break-words ${labelClass}`}>Ajuste conjunto</dt>
        <dd className={`ml-auto min-w-0 max-w-full break-words text-right font-bold ${valueClass}`}>
          {pendingAdjustment
            ? 'Pendiente de repartir'
            : formatCents(adjustmentCents, currency)}
        </dd>
      </div>
      <div
        className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-t pt-2 ${
          inverted ? 'border-on-brand/15' : 'border-border'
        }`}
      >
        <dt className={`min-w-0 break-words font-bold ${valueClass}`}>Total a aportar</dt>
        <dd className={`ml-auto min-w-0 max-w-full break-words text-right font-extrabold ${valueClass}`}>
          {pendingAdjustment ? 'Se confirma al preparar' : formatCents(resolvedTotal, currency)}
        </dd>
      </div>
    </dl>
  );
}
