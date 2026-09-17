import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('../../api/client', () => ({ http }));

import { queryKeys } from '../../api/queryKeys';
import { invalidatePurchasePaymentQueries, purchasePaymentsService } from './purchasePaymentsService';
import { purchaseInstallmentDefaults, purchaseInstallmentFormSchema, purchaseInstallmentPayload, purchasePaymentToday } from './purchaseInstallmentFormState';

describe('purchase payment transport and isolation', () => {
  beforeEach(() => vi.clearAllMocks());
  const ids = { householdId: 'home/a', purchaseId: 'purchase b', installmentId: 'item?x' };
  const path = '/households/home%2Fa/purchases/purchase%20b/installments/item%3Fx';
  it('registra pago por el dominio de compras sin crear otros gastos', async () => {
    const body = { actualAmountCents: 5500, paidAt: '2026-09-17', notes: null };
    http.post.mockResolvedValue({ id: 'purchase b' });
    await expect(purchasePaymentsService.pay({ ...ids, body })).resolves.toEqual({ id: 'purchase b' });
    expect(http.post).toHaveBeenCalledExactlyOnceWith(`${path}/pay`, body);
    expect(http.patch).not.toHaveBeenCalled();
  });
  it('corrige un pago existente por PATCH', async () => {
    const body = { actualAmountCents: 5400, paidAt: '2026-09-16', notes: 'Corregido' };
    await purchasePaymentsService.correct({ ...ids, body });
    expect(http.patch).toHaveBeenCalledExactlyOnceWith(`${path}/payment`, body);
  });
  it('envía confirmación explícita en el cuerpo de DELETE', async () => {
    await purchasePaymentsService.revert(ids);
    expect(http.delete).toHaveBeenCalledExactlyOnceWith(`${path}/payment`, { data: { confirm: true } });
  });
  it('propaga fallos sin aparentar éxito', async () => {
    const error = new Error('Ya está pagada');
    http.post.mockRejectedValue(error);
    await expect(purchasePaymentsService.pay({ ...ids, body: {} })).rejects.toBe(error);
  });
  it('invalida compra y finanzas de todos sus periodos, sin documentos ni otros hogares o gastos', async () => {
    const client = new QueryClient();
    const affected = [queryKeys.purchases.all('a'), queryKeys.purchases.detail('a', 'p'), queryKeys.budget('a'), queryKeys.dashboard('a', 'current'), queryKeys.dashboard('a', 'planning'), ['calendar', 'a', 'MONTH'], ['calendar', 'a', 'YEAR'], ['simulation', 'a', 12], ['plannings', 'a'], ['monthlyPlanning', 'a', '2026-08']];
    const unaffected = [queryKeys.purchases.all('b'), queryKeys.purchases.detail('a', 'q'), queryKeys.purchases.documents('a', 'p'), queryKeys.budget('b'), queryKeys.dashboard('b', 'current'), queryKeys.accounts('a'), queryKeys.oneTimeExpenses('a'), queryKeys.recurringExpenses.all('a'), ['calendar', 'b'], ['simulation', 'b'], ['plannings', 'b'], ['monthlyPlanning', 'b']];
    for (const key of [...affected, ...unaffected]) client.setQueryData(key, { original: true });
    await invalidatePurchasePaymentQueries(client, 'a', 'p');
    affected.forEach((key) => expect(client.getQueryState(key).isInvalidated).toBe(true));
    unaffected.forEach((key) => expect(client.getQueryState(key).isInvalidated).toBe(false));
    client.clear();
  });
  it('no inicia refetch cuando el panel ya está desmontado', async () => {
    const client = { invalidateQueries: vi.fn().mockResolvedValue(undefined) };
    await invalidatePurchasePaymentQueries(client, 'a', 'p', { active: false });
    expect(client.invalidateQueries).toHaveBeenCalledTimes(8);
    expect(client.invalidateQueries.mock.calls.every(([options]) => options.refetchType === 'none')).toBe(true);
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['purchases', 'a', 'detail', 'p'], exact: true, refetchType: 'none' });
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard', 'a'], refetchType: 'none' });
  });
});

describe('installment payment input', () => {
  const schema = purchaseInstallmentFormSchema('2026-09-17');
  const valid = { amount: '55,00', paidAt: '2026-09-17', notes: '' };
  it('usa importe esperado y hoy para una cuota pendiente', () => {
    expect(purchaseInstallmentDefaults({ expectedAmountCents: 3334 }, '2026-09-17')).toEqual({ amount: '33.34', paidAt: '2026-09-17', notes: '' });
  });
  it('usa datos reales al corregir una cuota pagada', () => {
    expect(purchaseInstallmentDefaults({ expectedAmountCents: 5500, actualAmountCents: 5600, paidAt: '2026-09-10T00:00:00Z', notes: 'Recibo' }, '2026-09-17')).toEqual({ amount: '56.00', paidAt: '2026-09-10', notes: 'Recibo' });
  });
  it('convierte céntimos exactos y limpia notas', () => {
    expect(purchaseInstallmentPayload(valid)).toEqual({ actualAmountCents: 5500, paidAt: '2026-09-17', notes: null });
    expect(purchaseInstallmentPayload({ ...valid, amount: '33.34', notes: '  Recibo  ' }).notes).toBe('Recibo');
  });
  it.each(['', '0', '-1', '1.001', 'Infinity', '21474836.48', '1e3'])('rechaza importe inválido %s', (amount) => {
    expect(schema.safeParse({ ...valid, amount }).success).toBe(false);
  });
  it.each(['', '2026-02-30', '17/09/2026', '2026-09-18'])('rechaza fecha inválida/futura %s', (paidAt) => {
    expect(schema.safeParse({ ...valid, paidAt }).success).toBe(false);
  });
  it('permite pago anterior al vencimiento sin requerir fecha de cuota', () => {
    expect(schema.safeParse({ ...valid, paidAt: '2026-08-01' }).success).toBe(true);
  });
  it('limita notas', () => expect(schema.safeParse({ ...valid, notes: 'x'.repeat(2001) }).success).toBe(false));
  it('calcula hoy en la zona del hogar y acepta fallback local', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-17T23:30:00Z'));
    expect(purchasePaymentToday('Europe/Madrid')).toBe('2026-09-18');
    expect(purchasePaymentToday('America/New_York')).toBe('2026-09-17');
    expect(purchasePaymentToday('Invalid/Zone')).toMatch(/^2026-09-\d{2}$/);
    vi.useRealTimers();
  });
});
