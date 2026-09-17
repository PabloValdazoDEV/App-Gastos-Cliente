import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
const publicEnv = vi.hoisted(() => ({ apiUrl: '/api' }));
vi.mock('../../api/client', () => ({ http }));
vi.mock('../../config/env', () => ({ publicEnv }));

import { purchaseDocumentsService as service } from './purchaseDocumentsService';
import { queryKeys } from '../../api/queryKeys';

const ids = { householdId: 'home', purchaseId: 'purchase', documentId: 'document' };
const base = '/households/home/purchases/purchase/documents';

describe('purchase documents API', () => {
  beforeEach(() => { vi.clearAllMocks(); publicEnv.apiUrl = '/api'; });

  it('lists metadata separately from the purchase and its financial data', async () => {
    const metadata = [{ id: 'document', filename: 'ticket.pdf', type: 'RECEIPT' }];
    http.get.mockResolvedValue(metadata);
    await expect(service.list(ids)).resolves.toBe(metadata);
    expect(http.get).toHaveBeenCalledWith(base);
  });

  it('uploads a raw file with safe encoded filename and purchase-level metadata', async () => {
    const file = new File(['pdf'], 'Garantía móvil.pdf', { type: 'application/pdf' });
    await service.upload({ ...ids, file, type: 'WARRANTY', purchaseItemId: null });
    expect(http.post).toHaveBeenCalledWith(base, file, {
      headers: { 'Content-Type': 'application/pdf', 'X-Document-Filename': encodeURIComponent(file.name) },
      params: { type: 'WARRANTY' }, timeout: 60000,
    });
  });

  it('associates with a product without embedding bytes in metadata JSON', async () => {
    const file = new File(['jpeg'], 'Ticket.JPEG');
    await service.upload({ ...ids, file, type: 'RECEIPT', purchaseItemId: 'item' });
    expect(http.post.mock.calls[0][1]).toBe(file);
    expect(http.post.mock.calls[0][2]).toMatchObject({ headers: { 'Content-Type': 'image/jpeg' }, params: { type: 'RECEIPT', purchaseItemId: 'item' } });
  });

  it('retrieves binary content as Blob through the authenticated HTTP client', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    http.get.mockResolvedValue(blob);
    await expect(service.content(ids)).resolves.toBe(blob);
    expect(http.get).toHaveBeenCalledWith(`${base}/document/content`, { responseType: 'blob', timeout: 60000 });
  });

  it('cancels metadata requests when their query leaves the screen', async () => {
    const signal = new AbortController().signal;
    await service.list({ ...ids, signal });
    expect(http.get).toHaveBeenCalledWith(base, { signal });
  });

  it.each(['/api', 'https://api.example.test/api/'])('constructs private native-view URLs for %s', (apiUrl) => {
    publicEnv.apiUrl = apiUrl;
    expect(service.contentUrl(ids)).toBe(`${apiUrl.replace(/\/$/, '')}${base}/document/content?disposition=inline`);
    expect(service.contentUrl({ ...ids, disposition: 'attachment' })).toContain('disposition=attachment');
  });

  it('encodes IDs and never makes user text part of a server file path', async () => {
    const unusual = { householdId: 'home/a', purchaseId: 'purchase?b', documentId: 'doc#c' };
    await service.content(unusual);
    expect(http.get.mock.calls[0][0]).toBe('/households/home%2Fa/purchases/purchase%3Fb/documents/doc%23c/content');
    expect(service.contentUrl({ ...unusual, disposition: 'inline&admin=true' })).toMatch(/\?disposition=attachment$/);
  });

  it('patches only metadata and deletes through the document endpoint', async () => {
    const body = { type: 'OTHER', purchaseItemId: null };
    await service.update({ ...ids, body });
    await service.remove(ids);
    expect(http.patch).toHaveBeenCalledWith(`${base}/document`, body);
    expect(http.delete).toHaveBeenCalledWith(`${base}/document`);
  });

  it('keeps document query invalidation isolated by purchase and household', async () => {
    const client = new QueryClient();
    const affected = queryKeys.purchases.documents('home', 'purchase');
    const unaffected = [queryKeys.purchases.documents('other', 'purchase'), queryKeys.purchases.documents('home', 'other'), queryKeys.purchases.detail('home', 'purchase'), queryKeys.budget('home'), queryKeys.accounts('home')];
    for (const key of [affected, ...unaffected]) client.setQueryData(key, []);
    await client.invalidateQueries({ queryKey: affected, exact: true });
    expect(client.getQueryState(affected).isInvalidated).toBe(true);
    for (const key of unaffected) expect(client.getQueryState(key).isInvalidated).toBe(false);
    client.clear();
  });
});
