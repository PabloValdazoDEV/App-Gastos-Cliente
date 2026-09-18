import { describe, expect, it } from 'vitest';
import { purchaseIntakeHints, purchaseIntakeQuantity, purchaseIntakeValues } from './purchaseIntakeState';

const extraction = { merchant: { name: 'Tienda' }, purchaseDate: { value: '2026-09-17' }, currency: 'EUR', totalCents: 870, items: [
  { name: 'A', quantity: 1, unitPriceCents: 550, totalPriceCents: 550 },
  { name: 'B', quantity: 1, unitPriceCents: 320, totalPriceCents: 320 },
] };
describe('purchase intake prefill', () => {
  it('uses only the selected line, never the multi-product receipt total', () => {
    expect(purchaseIntakeValues(extraction, 1, 'EUR')).toMatchObject({ total: '3.20', merchant: 'Tienda', items: [{ name: 'B', quantity: '1', warrantyEnabled: false }] });
  });
  it('uses final receipt total including discounts only for a single identified product', () => {
    expect(purchaseIntakeValues({ ...extraction, totalCents: 500, items: [extraction.items[0]] }, 0, 'EUR').total).toBe('5.00');
  });
  it('requires manual amounts for foreign or unknown currency', () => {
    for (const currency of ['USD', null]) expect(purchaseIntakeValues({ ...extraction, currency }, 1, 'EUR').total).toBe('');
  });
  it('keeps missing names, dates and amounts empty, proposing one unit with a visible caveat', () => {
    expect(purchaseIntakeValues({ currency: 'EUR', items: [] }, null, 'EUR')).toMatchObject({ total: '', purchaseDate: '', items: [{ name: '', quantity: '1', warrantyEnabled: false }] });
    expect(purchaseIntakeHints({ items: [] }, null)).toMatchObject({ quantity: expect.stringContaining('Proponemos 1 unidad'), date: expect.stringContaining('no ha identificado la fecha') });
  });
  it('uses integer line arithmetic and rejects amounts outside the allowed range', () => {
    const items = [{ name: 'A', quantity: 3, unitPriceCents: 123, totalPriceCents: null }, extraction.items[1]];
    expect(purchaseIntakeValues({ ...extraction, items }, 0, 'EUR').total).toBe('3.69');
    items[0].quantity = 10000; items[0].unitPriceCents = 2147483647;
    expect(purchaseIntakeValues({ ...extraction, items }, 0, 'EUR').total).toBe('');
  });
  it('preserves detected units and derives only exact bounded whole-unit ratios', () => {
    expect(purchaseIntakeQuantity({ quantity: 3, unitPriceCents: 100, totalPriceCents: 200 })).toEqual({ value: 3, source: 'DETECTED' });
    expect(purchaseIntakeQuantity({ quantity: null, unitPriceCents: 125, totalPriceCents: 500 })).toEqual({ value: 4, source: 'CALCULATED' });
    expect(purchaseIntakeQuantity({ quantity: null, unitPriceCents: 100, totalPriceCents: 150 })).toEqual({ value: 1, source: 'SUGGESTED' });
    expect(purchaseIntakeQuantity({ unitPriceCents: 0, totalPriceCents: 100 })).toEqual({ value: 1, source: 'SUGGESTED' });
    expect(purchaseIntakeQuantity({ unitPriceCents: 1, totalPriceCents: 10001 })).toEqual({ value: 1, source: 'SUGGESTED' });
  });
  it('fills the receipt date and detected duration for only the selected product', () => {
    const document = { ...extraction, items: [extraction.items[0], { ...extraction.items[1], quantity: 2, warranty: { durationMonths: 24, endsAt: null } }] };
    expect(purchaseIntakeValues(document, 1, 'EUR')).toMatchObject({ purchaseDate: '2026-09-17', items: [{ quantity: '2', warrantyEnabled: true, warrantyDuration: '2', warrantyUnit: 'YEARS', warrantyMethod: 'DURATION' }] });
    expect(purchaseIntakeValues(document, 0, 'EUR').items[0].warrantyEnabled).toBe(false);
    expect(purchaseIntakeHints(document, 1).warranty).toContain('detectada en el documento');
  });
  it('prefers a documented end date, without assuming a warranty from technology brands', () => {
    const document = { ...extraction, items: [{ ...extraction.items[0], name: 'Apple iPhone', warranty: { durationMonths: 12, endsAt: '2028-09-18' } }] };
    expect(purchaseIntakeValues(document, 0, 'EUR').items[0]).toMatchObject({ warrantyEnabled: true, warrantyEndsAt: '2028-09-18', warrantyMethod: 'EXPLICIT_DATE' });
    document.items[0].warranty = null;
    expect(purchaseIntakeValues(document, 0, 'EUR').items[0].warrantyEnabled).toBe(false);
  });
});
