import { useId } from 'react';

const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' });

function civilDate(value) {
  const date = typeof value === 'string' ? value.slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : '';
}

// These are calendar dates: converting offsets to the browser's timezone could
// move a payment on the first of the month into the preceding month or year.
export function MonthGroupedList({ items, getDate, renderItem, className = '', listClassName = 'space-y-3', yearHeadingLevel = 3, undatedLabel = 'Sin fecha' }) {
  const id = useId();
  const YearHeading = `h${yearHeadingLevel}`;
  const MonthHeading = `h${yearHeadingLevel + 1}`;
  const years = new Map();
  const undated = [];
  const sorted = items.map((item) => ({ item, date: civilDate(getDate(item)) }))
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const { item, date } of sorted) {
    if (!date) { undated.push(item); continue; }
    const year = date.slice(0, 4);
    const month = date.slice(0, 7);
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(item);
  }

  return <div className={`min-w-0 space-y-8 ${className}`}>
    {[...years].map(([year, months]) => <section aria-labelledby={`${id}-${year}`} className="min-w-0 space-y-5" key={year}>
      <YearHeading className="border-b border-border pb-2 text-2xl font-extrabold tabular-nums" id={`${id}-${year}`}>{year}</YearHeading>
      {[...months].map(([month, entries]) => {
        const label = monthFormatter.format(new Date(`${month}-01T12:00:00Z`));
        return <section aria-labelledby={`${id}-${month}`} className="min-w-0 space-y-3" key={month}>
          <MonthHeading className="text-lg font-bold text-brand-strong" id={`${id}-${month}`}>
            <time dateTime={month}>{label.charAt(0).toUpperCase() + label.slice(1)}</time>
          </MonthHeading>
          <ul className={listClassName}>{entries.map(renderItem)}</ul>
        </section>;
      })}
    </section>)}
    {undated.length > 0 ? <section aria-labelledby={`${id}-undated`} className="min-w-0 space-y-3">
      <YearHeading className="border-b border-border pb-2 text-xl font-extrabold" id={`${id}-undated`}>{undatedLabel}</YearHeading>
      <ul className={listClassName}>{undated.map(renderItem)}</ul>
    </section> : null}
  </div>;
}
