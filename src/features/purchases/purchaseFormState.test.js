import { describe, expect, it } from 'vitest';

import {
  addWarrantyMonths, isValidSplit, percentageToBps, purchaseDefaults, purchaseFormSchema,
  purchaseItemDefaults, purchaseItemFormSchema, purchaseItemPayload, purchasePayload, splitTotalBps,
} from './purchaseFormState';

const valid = (overrides = {}) => ({ ...purchaseDefaults(), total: '999', paidAmount: '999', paymentDate: '2026-09-17', purchaseDate: '2026-09-17', items: [{ ...purchaseItemDefaults(), name: 'iPhone 17' }], ...overrides });

describe('purchase form normalization and validation', () => {
  it('creates a household purchase with at least one product without inventing warranty or product price', () => {
    const values = purchaseFormSchema().parse(valid({ merchant: ' Apple Store ' }));
    expect(purchasePayload(values)).toEqual({
      merchant: 'Apple Store', purchaseDate: '2026-09-17', totalCents: 99900, notes: null,
      ownershipType: 'HOUSEHOLD', personalPersonId: null, shares: [],
      paymentMethod: 'UPFRONT', paymentDate: '2026-09-17', paidAmountCents: 99900,
      items: [{ name: 'iPhone 17', brand: null, model: null, quantity: 1, priceCents: null, serialNumber: null, imei: null, notes: null, warrantyEndsAt: null, warrantyDurationMonths: null }],
    });
  });

  it('rejects an empty purchase, empty product name and more than 50 products', () => {
    expect(purchaseFormSchema().safeParse(valid({ items: [] })).success).toBe(false);
    expect(purchaseItemFormSchema.safeParse(purchaseItemDefaults()).success).toBe(false);
    expect(purchaseFormSchema().safeParse(valid({ items: Array(51).fill({ ...purchaseItemDefaults(), name: 'Cable' }) })).success).toBe(false);
  });

  it('requires a personal owner and strips incompatible residual shares', () => {
    expect(purchaseFormSchema().safeParse(valid({ ownershipType: 'PERSONAL' })).success).toBe(false);
    const values = valid({ ownershipType: 'PERSONAL', personalPersonId: 'pablo', shares: [{ householdPersonId: 'natalia', percentage: '100' }] });
    expect(purchasePayload(purchaseFormSchema().parse(values))).toMatchObject({ personalPersonId: 'pablo', shares: [] });
    expect(purchasePayload({ ...values, ownershipType: 'HOUSEHOLD' })).toMatchObject({ personalPersonId: null, shares: [] });
  });

  it('normalizes 60/40 split to exact basis points, without a personal owner', () => {
    const values = valid({ ownershipType: 'SPLIT', personalPersonId: 'stale', shares: [{ householdPersonId: 'pablo', percentage: '60' }, { householdPersonId: 'natalia', percentage: '40' }] });
    expect(purchasePayload(purchaseFormSchema().parse(values))).toMatchObject({ personalPersonId: null, shares: [{ householdPersonId: 'pablo', shareBps: 6000 }, { householdPersonId: 'natalia', shareBps: 4000 }] });
  });

  it.each([
    [{ householdPersonId: 'a', percentage: '100' }],
    [{ householdPersonId: 'a', percentage: '60' }, { householdPersonId: 'b', percentage: '39.99' }],
    [{ householdPersonId: 'a', percentage: '60' }, { householdPersonId: 'a', percentage: '40' }],
    [{ householdPersonId: 'a', percentage: '100' }, { householdPersonId: 'b', percentage: '0' }],
    [{ householdPersonId: 'a', percentage: '-1' }, { householdPersonId: 'b', percentage: '101' }],
    [{ householdPersonId: 'a', percentage: '50.001' }, { householdPersonId: 'b', percentage: '49.999' }],
  ].map((shares) => [shares]))('rejects invalid ownership split %j', (shares) => {
    expect(isValidSplit(shares)).toBe(false);
    expect(purchaseFormSchema().safeParse(valid({ ownershipType: 'SPLIT', shares })).success).toBe(false);
  });

  it('accepts comma decimals and calculates exact split totals', () => {
    const shares = [{ householdPersonId: 'a', percentage: '33,33' }, { householdPersonId: 'b', percentage: '66,67' }];
    expect(isValidSplit(shares)).toBe(true);
    expect(splitTotalBps(shares)).toBe(10000);
    expect(percentageToBps('33,33')).toBe(3333);
    expect(splitTotalBps([{ percentage: '' }])).toBeNull();
  });

  it('accepts zero total and independent item prices; rejects negative or overflowing cents', () => {
    expect(purchaseFormSchema().safeParse(valid({ total: '0' })).success).toBe(true);
    expect(purchaseFormSchema().safeParse(valid({ total: '-1' })).success).toBe(false);
    expect(purchaseFormSchema().safeParse(valid({ total: '21474836.48' })).success).toBe(false);
    expect(purchaseFormSchema().safeParse(valid({ total: '1', items: [{ ...purchaseItemDefaults(), name: 'TV', price: '1000' }] })).success).toBe(true);
  });

  it('edits metadata only, preserving item edits for their own endpoint', () => {
    const values = purchaseFormSchema({ editing: true }).parse(valid());
    expect(purchasePayload(values, { editing: true })).not.toHaveProperty('items');
  });

  it('enforces integer quantities and reasonable text lengths without restricting serial formats', () => {
    const item = { ...purchaseItemDefaults(), name: 'Cable', serialNumber: ' serial / - 001 ', imei: 'custom identification' };
    expect(purchaseItemFormSchema.safeParse(item).success).toBe(true);
    expect(purchaseItemPayload(item).serialNumber).toBe('serial / - 001');
    for (const quantity of ['0', '1.5', '-1', '10001']) expect(purchaseItemFormSchema.safeParse({ ...item, quantity }).success).toBe(false);
    expect(purchaseItemFormSchema.safeParse({ ...item, serialNumber: 'a'.repeat(101) }).success).toBe(false);
  });
});

describe('calendar-based warranty form helpers', () => {
  it.each([
    ['2026-09-17', 36, '2029-09-17'], ['2026-01-31', 1, '2026-02-28'],
    ['2024-01-31', 1, '2024-02-29'], ['2024-02-29', 12, '2025-02-28'],
    ['2026-12-31', 2, '2027-02-28'], ['0099-01-31', 1, '0099-02-28'],
  ])('adds calendar months %s + %i = %s', (date, months, expected) => {
    expect(addWarrantyMonths(date, months)).toBe(expected);
  });

  it('rejects invalid dates, durations, and unrepresentable results', () => {
    expect(addWarrantyMonths('2026-02-30', 1)).toBeNull();
    expect(addWarrantyMonths('2026-01-31', 0)).toBeNull();
    expect(addWarrantyMonths('2026-01-31', 1.5)).toBeNull();
    expect(addWarrantyMonths('9999-12-31', 1)).toBeNull();
  });

  it('normalizes three years to 36 months without sending a competing explicit date', () => {
    const item = { ...purchaseItemDefaults(), name: 'iPhone 17', warrantyEnabled: true, warrantyDuration: '3', warrantyUnit: 'YEARS', warrantyEndsAt: '2030-01-01' };
    expect(purchaseItemPayload(purchaseItemFormSchema.parse(item))).toMatchObject({ warrantyDurationMonths: 36, warrantyEndsAt: null });
  });

  it('explicit method ignores stale duration and disabled warranty clears both values', () => {
    const item = { ...purchaseItemDefaults(), name: 'iPhone 17', warrantyEnabled: true, warrantyMethod: 'EXPLICIT_DATE', warrantyEndsAt: '2029-09-17', warrantyDuration: 'invalid' };
    expect(purchaseItemPayload(purchaseItemFormSchema.parse(item))).toMatchObject({ warrantyDurationMonths: null, warrantyEndsAt: '2029-09-17' });
    expect(purchaseItemPayload(purchaseItemFormSchema.parse({ ...item, warrantyEnabled: false }))).toMatchObject({ warrantyDurationMonths: null, warrantyEndsAt: null });
  });

  it('reconstructs editing mode from the stored warranty source', () => {
    expect(purchaseItemDefaults({ warrantySource: 'DURATION', warrantyDurationMonths: 36, warrantyEndsAt: '2029-09-17' })).toMatchObject({ warrantyEnabled: true, warrantyMethod: 'DURATION', warrantyDuration: '3', warrantyUnit: 'YEARS' });
    expect(purchaseItemDefaults({ warrantySource: 'EXPLICIT_DATE', warrantyEndsAt: '2029-09-17' })).toMatchObject({ warrantyEnabled: true, warrantyMethod: 'EXPLICIT_DATE', warrantyEndsAt: '2029-09-17' });
  });
});
