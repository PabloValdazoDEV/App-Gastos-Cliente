import { describe, expect, it } from 'vitest';

import { isPurchaseFinancialSource, purchaseFinancialScopeLabel, purchaseFinancialSourceLabel } from './purchaseFinancialPresentation';

describe('purchase financial presentation', () => {
  it.each([
    ['PURCHASE_UPFRONT', 'Compra al contado'],
    ['PURCHASE_DOWN_PAYMENT', 'Entrada de compra'],
    ['PURCHASE_INSTALLMENT', 'Cuota de compra'],
  ])('labels the explicit source %s', (sourceType, label) => {
    expect(isPurchaseFinancialSource(sourceType)).toBe(true);
    expect(purchaseFinancialSourceLabel(sourceType)).toBe(label);
  });
  it('does not guess purchase identity from arbitrary fields or unknown source strings', () => {
    expect(isPurchaseFinancialSource('RECURRING_EXPENSE')).toBe(false);
    expect(isPurchaseFinancialSource(undefined)).toBe(false);
    expect(isPurchaseFinancialSource('PURCHASE_UNKNOWN')).toBe(false);
  });
  it('explains SPLIT as a personal part, retaining exact basis points', () => {
    expect(purchaseFinancialScopeLabel({ ownershipType: 'SPLIT', scope: 'PERSONAL', shareBps: 3333 })).toBe('Tu parte de una compra repartida (33,33 %)');
    expect(purchaseFinancialScopeLabel({ ownershipType: 'SPLIT', scope: 'PERSONAL' })).toBe('Tu parte de una compra repartida');
    expect(purchaseFinancialScopeLabel({ ownershipType: 'HOUSEHOLD', scope: 'HOUSEHOLD' })).toBe('Gasto común');
    expect(purchaseFinancialScopeLabel({ ownershipType: 'PERSONAL', scope: 'PERSONAL' })).toBe('Gasto personal');
  });
});
