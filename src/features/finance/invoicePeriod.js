import { isoDate } from './money';

const DAY_MS = 86_400_000;

function utc(iso) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function toIso(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function addMonthsClamped(iso, months) {
  const [year, month, day] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

function sameGroup(invoice, { categoryId, scope, personalPersonId }) {
  const invoiceScope = invoice.scope ?? 'HOUSEHOLD';
  if ((invoice.categoryId ?? invoice.category?.id) !== categoryId || invoiceScope !== scope) return false;
  return scope !== 'PERSONAL' || (invoice.personalPersonId ?? invoice.personalPerson?.id) === personalPersonId;
}

/*
 * Billing period to propose for a new invoice.
 * - With a previous invoice of the same category and owner, the next period
 *   starts the day after it ended and lasts the same number of months
 *   (a 2-month electricity bill suggests the next 2 months).
 * - Without history, the whole previous calendar month, which is what most
 *   household bills cover.
 */
export function suggestedInvoicePeriod(invoices, group, today) {
  const previous = (invoices ?? [])
    .filter((invoice) => invoice.periodEnd && invoice.periodStart && sameGroup(invoice, group))
    .sort((left, right) => utc(isoDate(right.periodEnd)) - utc(isoDate(left.periodEnd)))[0];

  if (previous) {
    const previousStart = isoDate(previous.periodStart);
    const previousEnd = isoDate(previous.periodEnd);
    const days = (utc(previousEnd) - utc(previousStart)) / DAY_MS + 1;
    const months = Math.max(1, Math.round(days / 30.44));
    const periodStart = toIso(utc(previousEnd) + DAY_MS);
    const periodEnd = toIso(utc(addMonthsClamped(periodStart, months)) - DAY_MS);
    return { periodStart, periodEnd, basedOn: previous };
  }

  const [year, month] = today.slice(0, 7).split('-').map(Number);
  const periodStart = toIso(Date.UTC(year, month - 2, 1));
  const periodEnd = toIso(Date.UTC(year, month - 1, 0));
  return { periodStart, periodEnd, basedOn: null };
}
