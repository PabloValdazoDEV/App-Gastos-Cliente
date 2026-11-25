import { describe, expect, it } from 'vitest';

import { incomeInputToCents, incomePreviewBps } from './incomeSplit';

describe('reparto por sueldo en el cliente', () => {
  it('entiende el sueldo escrito como en España', () => {
    expect(incomeInputToCents('30.000')).toBe(3_000_000);
    expect(incomeInputToCents('30000')).toBe(3_000_000);
    expect(incomeInputToCents('30.000,50 €')).toBe(3_000_050);
    expect(() => incomeInputToCents('treinta mil')).toThrow(/bruto anual/);
  });

  it('previsualiza el mismo reparto que el servidor', () => {
    const preview = incomePreviewBps([
      { id: 'ana', active: true, income: '30.000' },
      { id: 'luis', active: true, income: '20.000' },
      { id: 'eva', active: false, income: '99.000' },
    ]);
    expect(Object.fromEntries(preview)).toEqual({ ana: 6000, luis: 4000 });
  });
});
