import { describe, expect, it } from 'vitest';

import { expenseFrequencies, formatFrequency, frequencyOptions, isValidIntervalWeeks } from './recurringFrequency';

describe('recurringFrequency', () => {
  it('comparte las frecuencias entre opciones y validación sin duplicados', () => {
    expect(expenseFrequencies).toEqual(Object.keys(frequencyOptions));
    expect(new Set(expenseFrequencies).size).toBe(9);
  });

  it.each([
    [{ frequency: 'WEEKLY' }, 'Semanal'],
    [{ frequency: 'CUSTOM_WEEKS', intervalWeeks: 2 }, 'Cada 2 semanas'],
    [{ frequency: 'CUSTOM_WEEKS', intervalWeeks: 3 }, 'Cada 3 semanas'],
    [{ frequency: 'CUSTOM_WEEKS', intervalWeeks: 4 }, 'Cada 4 semanas'],
    [{ frequency: 'CUSTOM_WEEKS', intervalWeeks: 520 }, 'Cada 520 semanas'],
    [{ frequency: 'CUSTOM_WEEKS' }, 'Cada varias semanas'],
    [{ frequency: 'MONTHLY' }, 'Mensual'],
    [{ frequency: 'BIMONTHLY' }, 'Bimestral'],
    [{ frequency: 'QUARTERLY' }, 'Trimestral'],
    [{ frequency: 'SEMIANNUAL' }, 'Semestral'],
    [{ frequency: 'YEARLY' }, 'Anual'],
    [{ frequency: 'CUSTOM_MONTHS', intervalMonths: 3 }, 'Cada 3 meses'],
    [{ frequency: 'CUSTOM_MONTHS', intervalMonths: 1 }, 'Cada 1 mes'],
    [{ frequency: 'CUSTOM_MONTHS' }, 'Cada varios meses'],
    [{ frequency: 'ONE_TIME' }, 'Pago único'],
  ])('formatea %j con «%s»', (expense, label) => {
    expect(formatFrequency(expense)).toBe(label);
  });

  it.each([null, undefined, 0, 1, -3, 2.5, 521, Infinity, NaN, '4'])('no trata %s como un intervalo válido', (interval) => {
    expect(isValidIntervalWeeks(interval)).toBe(false);
  });
});
