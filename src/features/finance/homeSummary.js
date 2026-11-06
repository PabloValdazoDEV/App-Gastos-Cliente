import { todayIso } from '../../pages/expensePageUtils';

export function daysBetween(fromIso, toIso) {
  const [fy, fm, fd] = fromIso.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = toIso.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

export function dueLabel(dueDate, today = todayIso()) {
  const days = daysBetween(today, dueDate);
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  if (days > 1) return `Vence en ${days} días`;
  if (days === -1) return 'Venció ayer';
  return `Venció hace ${-days} días`;
}

/*
 * The viewer's own contribution for the month: the prepared one when the
 * month is prepared (with what is still pending), otherwise today's estimate.
 */
export function viewerContribution(data) {
  const prepared = data.planning?.contributions?.find((item) => item.canConfirmPersonal);
  if (prepared) {
    return {
      prepared: true,
      totalCents: prepared.totalRecommendedCents + (prepared.extraFunding?.agreedCents ?? 0),
      pendingCents: prepared.totalPendingCents ?? null,
    };
  }
  const estimate = data.viewerPersonId
    ? data.budget?.contributions?.find((item) => item.personId === data.viewerPersonId)
    : null;
  if (!estimate || !data.budget?.readiness?.ready) return null;
  return { prepared: false, totalCents: estimate.totalStandardCents, pendingCents: null };
}
