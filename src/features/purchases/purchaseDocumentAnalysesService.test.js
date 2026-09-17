import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../api/client', () => ({ http }));
import { queryKeys } from '../../api/queryKeys';
import { invalidatePurchaseAnalysisConfirmation, purchaseDocumentAnalysesService as service } from './purchaseDocumentAnalysesService';

const ids = { householdId: 'home/a', purchaseId: 'purchase?b', documentId: 'document#c' };
const base = '/households/home%2Fa/purchases/purchase%3Fb/documents/document%23c';
describe('purchase document analyses transport', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lists privately with cancellation and escaped IDs', async () => {
    const signal = new AbortController().signal;
    await service.list({ ...ids, signal });
    expect(http.get).toHaveBeenCalledWith(`${base}/analyses`, { signal });
  });
  it('sends explicit consent, no file bytes or provider secrets, with a bounded timeout', async () => {
    await service.analyze(ids);
    expect(http.post).toHaveBeenCalledWith(`${base}/analyze`, { consent: true }, { timeout: 120000 });
    expect(http.post).toHaveBeenCalledOnce();
  });
  it('submits the reviewed values and version, not a blind confirmation', async () => {
    const body = { purchaseVersion: 'version', reviewedData: { merchant: 'Revisado' }, apply: { items: 'NONE' } };
    await service.confirm({ ...ids, analysisId: 'analysis/a', body });
    expect(http.post).toHaveBeenCalledWith(`${base}/analyses/analysis%2Fa/confirm`, body);
  });
  it('invalidates financial views only after explicit confirmation, scoped by household', async () => {
    const client = new QueryClient(); const invalidate = vi.spyOn(client, 'invalidateQueries');
    await invalidatePurchaseAnalysisConfirmation(client, 'home', 'purchase', 'document');
    expect(invalidate.mock.calls.map(([options]) => options.queryKey[0])).toEqual(expect.arrayContaining(['budget', 'dashboard', 'calendar', 'simulation', 'plannings', 'monthlyPlanning']));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.purchases.analyses('home', 'purchase', 'document'), exact: true });
    expect(invalidate.mock.calls.every(([options]) => options.queryKey[1] === 'home')).toBe(true);
    expect(invalidate.mock.calls.some(([options]) => options.queryKey[0] === 'accounts')).toBe(false);
  });
  it('late confirmation invalidates without active refetches or populating private caches', async () => {
    const client = new QueryClient(); const invalidate = vi.spyOn(client, 'invalidateQueries');
    await invalidatePurchaseAnalysisConfirmation(client, 'home', 'purchase', 'document', { active: false });
    expect(invalidate.mock.calls.every(([options]) => options.refetchType === 'none')).toBe(true);
    expect(client.getQueryData(queryKeys.purchases.detail('home', 'purchase'))).toBeUndefined();
  });
});
