import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../development/developmentDate', () => ({ getDevelopmentDate: vi.fn(() => null) }));
import { getDevelopmentDate } from '../development/developmentDate';
import { calendarToday, shiftCalendarMonth } from './calendarPeriod';

afterEach(() => { vi.useRealTimers(); vi.mocked(getDevelopmentDate).mockReturnValue(null); });
describe('calendar month navigation', () => {
  it.each([['2026-01', -1, '2025-12'], ['2026-12', 1, '2027-01'], ['2028-01', 1, '2028-02'], ['2028-03', -1, '2028-02']])('moves %s by %s month(s)', (month, offset, expected) => {
    expect(shiftCalendarMonth(month, offset)).toBe(expected);
  });
  it('uses the household timezone at the month boundary', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T23:30:00Z'));
    expect(calendarToday('Europe/Madrid')).toBe('2026-10-01');
    expect(calendarToday('America/New_York')).toBe('2026-09-30');
  });
  it('uses the simulated business date when enabled', () => {
    vi.mocked(getDevelopmentDate).mockReturnValue('2028-02-29');
    expect(calendarToday('Europe/Madrid')).toBe('2028-02-29');
  });
});
