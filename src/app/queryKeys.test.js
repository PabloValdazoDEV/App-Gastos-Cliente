import { describe, expect, it } from 'vitest';

import { queryKeys } from '../api/queryKeys';

describe('queryKeys', () => {
  it('separates calendar months while keeping the household invalidation prefix', () => {
    expect(queryKeys.calendar('home', 'MONTH', '2026-09-01')).toEqual(['calendar', 'home', 'MONTH', '2026-09-01']);
    expect(queryKeys.calendar('home', 'MONTH', '2026-09-01')).not.toEqual(queryKeys.calendar('home', 'MONTH', '2026-10-01'));
    expect(queryKeys.calendar('home', '90_DAYS')).toEqual(['calendar', 'home', '90_DAYS']);
  });
  it('mantiene hogares distintos en cachés separadas', () => {
    expect(queryKeys.dashboard('hogar-a', '2026-08')).not.toEqual(
      queryKeys.dashboard('hogar-b', '2026-08'),
    );
  });

  it('permite invalidar toda la planificación de un hogar', () => {
    expect(queryKeys.monthlyPlanning.all('hogar-a')).toEqual([
      'monthlyPlanning',
      'hogar-a',
    ]);
    expect(queryKeys.monthlyPlanning.detail('hogar-a', '2026-08')).toEqual([
      'monthlyPlanning',
      'hogar-a',
      '2026-08',
    ]);
  });

  it('separa los documentos por factura y hogar', () => {
    expect(queryKeys.invoices.documents('hogar-a', 'factura-1')).toEqual([
      'invoices',
      'hogar-a',
      'documents',
      'factura-1',
    ]);
    expect(queryKeys.invoices.documents('hogar-a', 'factura-1')).not.toEqual(
      queryKeys.invoices.documents('hogar-a', 'factura-2'),
    );
  });
});
