import { describe, expect, it } from 'vitest';

import { suggestedInvoicePeriod } from './invoicePeriod';

const luz = { categoryId: 'luz', scope: 'HOUSEHOLD', personalPersonId: '' };

describe('suggestedInvoicePeriod', () => {
  it('sin facturas anteriores propone el mes natural anterior', () => {
    expect(suggestedInvoicePeriod([], luz, '2026-11-06')).toEqual({
      periodStart: '2026-10-01', periodEnd: '2026-10-31', basedOn: null,
    });
  });

  it('en enero propone diciembre del año anterior', () => {
    expect(suggestedInvoicePeriod([], luz, '2027-01-10')).toMatchObject({
      periodStart: '2026-12-01', periodEnd: '2026-12-31',
    });
  });

  it('continúa justo después de la última factura de luz y con la misma duración', () => {
    const invoices = [
      { categoryId: 'luz', scope: 'HOUSEHOLD', periodStart: '2026-08-15', periodEnd: '2026-09-14' },
      { categoryId: 'luz', scope: 'HOUSEHOLD', periodStart: '2026-09-15', periodEnd: '2026-10-14' },
      { categoryId: 'agua', scope: 'HOUSEHOLD', periodStart: '2026-10-01', periodEnd: '2026-11-30' },
    ];
    expect(suggestedInvoicePeriod(invoices, luz, '2026-11-06')).toMatchObject({
      periodStart: '2026-10-15', periodEnd: '2026-11-14',
    });
  });

  it('una factura bimestral propone los dos meses siguientes', () => {
    const invoices = [{ categoryId: 'luz', scope: 'HOUSEHOLD', periodStart: '2026-07-01', periodEnd: '2026-08-31' }];
    expect(suggestedInvoicePeriod(invoices, luz, '2026-11-06')).toMatchObject({
      periodStart: '2026-09-01', periodEnd: '2026-10-31',
    });
  });

  it('no mezcla las facturas personales de otra persona', () => {
    const invoices = [{ categoryId: 'luz', scope: 'PERSONAL', personalPersonId: 'ana', periodStart: '2026-09-01', periodEnd: '2026-09-30' }];
    expect(suggestedInvoicePeriod(invoices, { categoryId: 'luz', scope: 'PERSONAL', personalPersonId: 'pablo' }, '2026-11-06').basedOn).toBeNull();
  });
});
