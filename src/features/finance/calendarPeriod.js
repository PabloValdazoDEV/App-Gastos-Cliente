import { getDevelopmentDate } from '../development/developmentDate';

export function calendarToday(timezone = 'UTC') {
  const simulated = getDevelopmentDate();
  if (simulated) return simulated;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// Start on day 1 so moving from January 31 never skips February.
export function shiftCalendarMonth(month, offset) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}
