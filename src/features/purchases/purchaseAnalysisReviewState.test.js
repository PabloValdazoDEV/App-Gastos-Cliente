import { describe, expect, it } from 'vitest';

import { analysisDocumentSupported, analysisItemDefaults, analysisMoney, analysisReviewDefaults, analysisReviewMismatch, analysisReviewPayload, analysisReviewSchema, analysisTotalProtected } from './purchaseAnalysisReviewState';
import { analysisPurchaseFixture as purchase, receiptAnalysisFixture as analysis } from './purchaseAnalysisFixtures';

describe('receipt analysis review state', () => {
  it.each(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])('only offers analysis for supported %s', (contentType) => expect(analysisDocumentSupported({ contentType })).toBe(true));
  it.each(['text/html', 'image/svg+xml', undefined])('rejects unsupported MIME %s', (contentType) => expect(analysisDocumentSupported({ contentType })).toBe(false));
  it.each([['12,99', 1299], ['12.99', 1299], ['1.299,99', 129999], ['', null], ['0', 0]])('parses reviewed money %s as exact cents', (input, cents) => expect(analysisMoney(input)).toBe(cents));
  it.each(['-1', '12.999', 'NaN', '21474836.48'])('rejects invalid money %s', (input) => expect(analysisMoney(input)).toBeNaN());
  it('does not invent unknown product quantities or prices', () => {
    expect(analysisItemDefaults({ quantity: null, unitPriceCents: null, totalPriceCents: null })).toMatchObject({ quantity: '', unitPrice: '', totalPrice: '' });
  });
  it('preserves missing extraction data and clearly chooses existing purchase defaults for review', () => {
    const extractedData = { ...analysis.extractedData, merchant: { name: null, confidence: 'LOW' }, purchaseDate: { value: null, confidence: 'LOW' }, totalCents: null };
    const values = analysisReviewDefaults({ ...analysis, extractedData }, purchase);
    expect(values).toMatchObject({ merchant: 'Tienda original', purchaseDate: '2026-09-16', total: '9.00', applyItems: false });
    expect(extractedData.merchant.name).toBeNull(); expect(extractedData.totalCents).toBeNull();
  });
  it('only appends products with an explicit choice and never emits payment, ownership or warranty fields', () => {
    const values = analysisReviewDefaults(analysis, purchase);
    const payload = analysisReviewPayload(values, analysis);
    expect(payload).toMatchObject({ purchaseVersion: 'version-1', apply: { merchant: true, purchaseDate: true, total: true, items: 'NONE' }, reviewedData: { totalCents: 870 } });
    expect(Object.keys(payload.reviewedData)).toEqual(['merchant', 'purchaseDate', 'totalCents', 'currency', 'items']);
    expect(Object.keys(payload.reviewedData.items[0])).toEqual(['name', 'quantity', 'unitPriceCents', 'totalPriceCents', 'brand', 'model']);
    expect(analysisReviewPayload({ ...values, applyItems: true }, analysis).apply.items).toBe('ADD');
  });
  it('requires acknowledgement only when a complete line sum differs from total', () => {
    const values = analysisReviewDefaults(analysis, purchase); values.total = '10';
    expect(analysisReviewMismatch(values)).toBe(true);
    expect(analysisReviewSchema(purchase).safeParse(values).success).toBe(false);
    expect(analysisReviewSchema(purchase).safeParse({ ...values, acknowledgeTotalMismatch: true }).success).toBe(true);
    values.items[0].totalPrice = '';
    expect(analysisReviewMismatch(values)).toBe(false);
  });
  it('validates dates, unknown quantities, names and the full item-count limit without inventing data', () => {
    const values = analysisReviewDefaults(analysis, purchase);
    values.purchaseDate = '2026-02-31'; values.applyItems = true; values.items[0].name = ''; values.items[0].quantity = '';
    const result = analysisReviewSchema(purchase).safeParse(values);
    expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(expect.arrayContaining(['purchaseDate', 'items.0.name', 'items.0.quantity']));
    const full = { ...purchase, items: Array.from({ length: 49 }, (_, i) => ({ id: String(i) })) };
    expect(analysisReviewSchema(full).safeParse({ ...analysisReviewDefaults(analysis, full), applyItems: true }).error.issues.some((issue) => issue.path[0] === 'applyItems')).toBe(true);
  });
  it('blocks protected totals while allowing metadata and product review', () => {
    const paid = { ...purchase, paymentMethod: 'FINANCED', financing: { installments: [{ status: 'PAID' }] } };
    expect(analysisTotalProtected(paid)).toBe(true);
    const values = analysisReviewDefaults(analysis, paid);
    expect(values.applyTotal).toBe(false);
    expect(analysisReviewSchema(paid).safeParse(values).success).toBe(true);
    expect(analysisReviewSchema(paid).safeParse({ ...values, applyTotal: true }).success).toBe(false);
  });
  it('rejects currency conversion when applying amounts', () => {
    const values = { ...analysisReviewDefaults(analysis, purchase), currency: 'USD' };
    expect(analysisReviewSchema(purchase).safeParse(values).success).toBe(false);
    expect(analysisReviewSchema(purchase).safeParse({ ...values, applyTotal: false, applyItems: false }).success).toBe(true);
  });
});
