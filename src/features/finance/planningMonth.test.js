import { describe, expect, it } from 'vitest';
import { isPlanningMonth, nextPlanningMonth, planningMonthLabel } from './planningMonth';

describe('salary month selection', () => {
  it.each([['2026-10-29', '2026-11'], ['2026-12-31', '2027-01'], ['2028-01-31', '2028-02'], ['2026-10-01', '2026-11']])('selects next full month from %s', (today, expected) => {
    expect(nextPlanningMonth(today)).toBe(expected);
  });
  it('validates the supported calendar range and formats the month without timezone shifts', () => {
    expect(planningMonthLabel('2026-11')).toBe('noviembre de 2026');
    for (const value of ['', '2026-00', '2026-13', '2026-11-01', '1999-12', '2201-01']) expect(isPlanningMonth(value)).toBe(false);
    expect(isPlanningMonth('2200-12')).toBe(true);
  });
});
