import { describe, expect, it, vi } from 'vitest';

import { purchaseDefaults, purchaseFormSchema, purchaseItemDefaults, purchasePayload } from './purchaseFormState';
import { financingPreview, hasRecordedFinancingPayments, MAX_PURCHASE_INSTALLMENTS, purchasePaymentDefaults, purchasePaymentNeedsReset, purchasePaymentPayload } from './purchasePaymentForm';

const financed = (overrides = {}) => ({ ...purchaseDefaults(), total: '1200', purchaseDate: '2026-09-17', items: [{ ...purchaseItemDefaults(), name: 'Móvil' }], paymentMethod: 'FINANCED', financingProvider: ' Banco ', downPayment: '200', installmentCount: '20', installmentAmount: '55', firstInstallmentDate: '2026-10-15', financingTotal: '1100', ...overrides });
const existing = {
  id: 'purchase', totalCents: 120000, purchaseDate: '2026-09-17', paymentMethod: 'FINANCED',
  financing: { provider: 'Banco', downPaymentCents: 20000, downPaymentPaidAt: null, financedPrincipalCents: 100000, installmentCount: 20, installmentAmountCents: 5500, firstInstallmentDate: '2026-10-15T00:00:00Z', financingTotalCents: 110000, installments: [{ status: 'PLANNED' }], progress: { paidInstallmentCount: 0 } },
};

describe('purchase payment form calculations and validation', () => {
  it('separates price, principal, entry, installment total and financing cost exactly', () => {
    expect(financingPreview(financed())).toEqual({ priceCents: 120000, downPaymentCents: 20000, financedPrincipalCents: 100000, financingTotalCents: 110000, totalCostCents: 130000, financingCostCents: 10000, installmentCount: 20, installmentAmountCents: 5500, lastInstallmentCents: 5500 });
    expect(purchaseFormSchema().safeParse(financed()).success).toBe(true);
  });

  it('normalizes only financing fields; down payment remains unconfirmed', () => {
    const payload = purchasePayload(purchaseFormSchema().parse(financed()));
    expect(payload).toMatchObject({ paymentMethod: 'FINANCED', financing: { provider: 'Banco', downPaymentCents: 20000, downPaymentPaidAt: null, installmentCount: 20, installmentAmountCents: 5500, firstInstallmentDate: '2026-10-15', financingTotalCents: 110000 } });
    expect(payload).not.toHaveProperty('paidAmountCents');
    expect(payload.financing).not.toHaveProperty('financedPrincipalCents');
  });

  it('only records down payment when explicitly confirmed and dated', () => {
    const values = financed({ downPaymentPaid: true, downPaymentPaidAt: '2026-09-17' });
    expect(purchasePaymentPayload(values).financing.downPaymentPaidAt).toBe('2026-09-17');
    expect(purchaseFormSchema().safeParse({ ...values, downPaymentPaidAt: '' }).success).toBe(false);
    expect(purchasePaymentPayload({ ...values, downPayment: '0' }).financing.downPaymentPaidAt).toBeNull();
  });

  it('preserves cents by adjusting the last installment, including comma decimals', () => {
    const values = financed({ total: '100', downPayment: '0', installmentCount: '3', installmentAmount: '33,33', financingTotal: '100' });
    expect(financingPreview(values).lastInstallmentCents).toBe(3334);
    expect(purchaseFormSchema().safeParse(values).success).toBe(true);
    expect(purchasePaymentPayload(values).financing.installmentAmountCents).toBe(3333);
  });

  it.each([
    ['downPayment', '-1'], ['downPayment', '1201'], ['downPayment', '1.001'],
    ['installmentCount', '0'], ['installmentCount', '-1'], ['installmentCount', '1.5'], ['installmentCount', String(MAX_PURCHASE_INSTALLMENTS + 1)],
    ['installmentAmount', '0'], ['installmentAmount', '-5'], ['installmentAmount', '21474836.48'],
    ['financingTotal', '999'], ['financingTotal', '21474836.48'],
    ['firstInstallmentDate', '2026-02-30'], ['firstInstallmentDate', '9999-12-01'], ['financingProvider', 'x'.repeat(201)],
  ])('rejects invalid %s=%s', (field, value) => {
    const result = purchaseFormSchema().safeParse(financed({ [field]: value }));
    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it('rejects an exhausted or negative last installment rather than losing cents', () => {
    for (const installmentAmount of ['100', '1100']) {
      const result = purchaseFormSchema().safeParse(financed({ installmentAmount }));
      expect(result.success).toBe(false);
      expect(result.error.issues.some((issue) => issue.message.includes('última cuota'))).toBe(true);
    }
  });

  it('permits one installment and a larger adjusted final installment', () => {
    expect(purchaseFormSchema().safeParse(financed({ installmentCount: '1' })).success).toBe(true);
    expect(financingPreview(financed({ installmentCount: '1' })).lastInstallmentCents).toBe(110000);
  });

  it('does not overflow derived final cost when two valid INT32 inputs are added', () => {
    const values = financed({ total: '21474836.47', downPayment: '21474836.47', financingTotal: '21474836.47', installmentCount: '1', installmentAmount: '21474836.47' });
    expect(financingPreview(values).totalCostCents).toBe(4294967294);
    expect(purchaseFormSchema().safeParse(values).success).toBe(true);
  });

  it('legacy defaults do not infer a payment and metadata-only payload omits payment fields', () => {
    const purchase = { totalCents: 99900, purchaseDate: '2026-09-17', paymentMethod: 'UPFRONT', paymentDate: null, paidAmountCents: null };
    const values = { ...purchaseDefaults(purchase), merchant: 'Otra tienda' };
    expect(values.upfrontPaid).toBe(false);
    expect(purchasePaymentPayload(values, { editing: true, initialPurchase: purchase })).toEqual({});
    expect(purchaseFormSchema({ editing: true, initialPurchase: purchase }).safeParse(values).success).toBe(true);
  });

  it('upfront stores a separate actual amount/date and ignores stale financing inputs', () => {
    const values = financed({ paymentMethod: 'UPFRONT', upfrontPaid: true, paidAmount: '1180,50', paymentDate: '2026-09-16', installmentCount: '-1', downPayment: 'not valid' });
    expect(purchaseFormSchema().safeParse(values).success).toBe(true);
    expect(purchasePaymentPayload(values)).toEqual({ paymentMethod: 'UPFRONT', paymentDate: '2026-09-16', paidAmountCents: 118050 });
    expect(purchaseFormSchema().safeParse({ ...values, paymentDate: '' }).success).toBe(false);
    expect(purchaseFormSchema().safeParse({ ...values, paidAmount: '' }).success).toBe(false);
  });

  it('validates real payment dates against the household timezone while allowing future due dates', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-17T23:30:00Z'));
    try {
      const values = financed({ paymentMethod: 'UPFRONT', upfrontPaid: true, paidAmount: '1200', paymentDate: '2026-09-18' });
      expect(purchaseFormSchema({ timezone: 'Europe/Madrid' }).safeParse(values).success).toBe(true);
      expect(purchaseFormSchema({ timezone: 'America/New_York' }).safeParse(values).success).toBe(false);
      const entry = financed({ downPaymentPaid: true, downPaymentPaidAt: '2026-09-18' });
      expect(purchaseFormSchema({ timezone: 'Europe/Madrid' }).safeParse(entry).success).toBe(true);
      expect(purchaseFormSchema({ timezone: 'America/New_York' }).safeParse(entry).success).toBe(false);
      expect(purchaseFormSchema({ timezone: 'America/New_York' }).safeParse(financed({ firstInstallmentDate: '2030-12-31' })).success).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it('only sends changed financing metadata, preserving installment IDs and recorded payment fields', () => {
    const values = { ...purchaseDefaults(existing), financingProvider: ' Nueva entidad ' };
    expect(purchasePaymentPayload(values, { editing: true, initialPurchase: existing })).toEqual({ financing: { provider: 'Nueva entidad' } });
    expect(purchasePaymentPayload({ ...values, financingProvider: 'Banco' }, { editing: true, initialPurchase: existing })).toEqual({});
  });

  it('detects paid history from installment status or progress summary', () => {
    expect(hasRecordedFinancingPayments(existing)).toBe(false);
    expect(hasRecordedFinancingPayments({ financing: { installments: [{ status: 'PAID' }] } })).toBe(true);
    expect(hasRecordedFinancingPayments({ financing: { progress: { paidInstallmentCount: 1 } } })).toBe(true);
    expect(hasRecordedFinancingPayments({ financing: { installments: [{ status: 'CANCELLED' }] } })).toBe(false);
  });

  it.each([
    { total: '1201' }, { paymentMethod: 'UPFRONT' }, { downPayment: '201' }, { installmentCount: '21' },
    { installmentAmount: '54' }, { financingTotal: '1200' }, { firstInstallmentDate: '2026-11-15' },
  ])('blocks structural edits with recorded payments: %j', (changes) => {
    const paid = { ...existing, financing: { ...existing.financing, installments: [{ status: 'PAID' }] } };
    const values = { ...purchaseDefaults(paid), ...changes };
    expect(purchaseFormSchema({ editing: true, initialPurchase: paid }).safeParse(values).success).toBe(false);
    expect(purchaseFormSchema({ editing: true, initialPurchase: paid }).safeParse({ ...purchaseDefaults(paid), financingProvider: 'Otra entidad' }).success).toBe(true);
  });

  it('requires confirmation for replacing upfront or down payment history but not ordinary metadata', () => {
    const upfront = { ...existing, paymentMethod: 'UPFRONT', paymentDate: '2026-09-17', paidAmountCents: 120000, financing: null };
    expect(purchasePaymentNeedsReset(financed(), upfront)).toBe(true);
    expect(purchasePaymentNeedsReset({ ...purchasePaymentDefaults(upfront), upfrontPaid: false }, upfront)).toBe(true);
    expect(purchasePaymentNeedsReset({ ...purchasePaymentDefaults(upfront), paymentDate: '2026-09-16' }, upfront)).toBe(false);
    const withEntry = { ...existing, financing: { ...existing.financing, downPaymentPaidAt: '2026-09-17' } };
    expect(purchasePaymentNeedsReset({ ...purchaseDefaults(withEntry), paymentMethod: 'UPFRONT' }, withEntry)).toBe(true);
    expect(purchasePaymentNeedsReset({ ...purchaseDefaults(withEntry), downPayment: '100' }, withEntry)).toBe(true);
    expect(purchasePaymentNeedsReset({ ...purchaseDefaults(withEntry), downPaymentPaid: false }, withEntry)).toBe(true);
    expect(purchasePaymentNeedsReset({ ...purchaseDefaults(withEntry), financingProvider: 'Nueva' }, withEntry)).toBe(false);
  });

  it('resends the explicit entry date when correcting a paid entry amount, after confirmation', () => {
    const initialPurchase = { ...existing, financing: { ...existing.financing, downPaymentPaidAt: '2026-09-17' } };
    const values = { ...purchaseDefaults(initialPurchase), downPayment: '201' };
    expect(purchasePaymentNeedsReset(values, initialPurchase)).toBe(true);
    expect(purchasePaymentPayload(values, { initialPurchase, editing: true })).toEqual({ financing: { downPaymentCents: 20100, downPaymentPaidAt: '2026-09-17' } });
  });
});
