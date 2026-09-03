import { describe, expect, it } from 'vitest';

import { queryKeys } from '../api/queryKeys';

describe('queryKeys', () => {
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
