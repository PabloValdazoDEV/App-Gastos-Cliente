import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('../../api/client', () => ({ http }));

import { queryKeys } from '../../api/queryKeys';
import { purchasesService } from './purchasesService';
import { invalidatePurchaseQueries } from './invalidatePurchaseQueries';

describe('purchasesService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lee listado y detalle del hogar sin consultar finance', async () => {
    const data = [{ id: 'purchase' }];
    http.get.mockResolvedValue(data);
    await expect(purchasesService.list('home')).resolves.toBe(data);
    await purchasesService.detail({ householdId: 'home', purchaseId: 'purchase' });
    expect(http.get.mock.calls).toEqual([
      ['/households/home/purchases'], ['/households/home/purchases/purchase'],
    ]);
  });

  it('crea compra con sus productos y actualiza metadatos por rutas separadas', async () => {
    const body = { purchaseDate: '2026-09-17', totalCents: 99900, ownershipType: 'PERSONAL', personalPersonId: 'person', items: [{ name: 'iPhone 17', warrantyDurationMonths: 36 }] };
    http.post.mockResolvedValue({ id: 'purchase', ...body });
    await expect(purchasesService.create({ householdId: 'home', body })).resolves.toMatchObject({ totalCents: 99900 });
    const update = { merchant: 'Apple Store' };
    await purchasesService.update({ householdId: 'home', purchaseId: 'purchase', body: update });
    expect(http.post).toHaveBeenCalledWith('/households/home/purchases', body);
    expect(http.patch).toHaveBeenCalledWith('/households/home/purchases/purchase', update);
  });

  it('cancela la consulta de detalle cuando se abandona el formulario del calendario', async () => {
    const { signal } = new AbortController();
    await purchasesService.detail({ householdId: 'home', purchaseId: 'purchase', signal });
    expect(http.get).toHaveBeenCalledExactlyOnceWith('/households/home/purchases/purchase', { signal });
  });

  it('usa DELETE para archivar una compra, sin borrar productos desde cliente', async () => {
    await purchasesService.archive({ householdId: 'home', purchaseId: 'purchase' });
    expect(http.delete.mock.calls).toEqual([['/households/home/purchases/purchase']]);
  });

  it('crea, edita y elimina productos dentro de su compra y hogar', async () => {
    const body = { name: 'Monitor', quantity: 1, warrantyEndsAt: '2029-09-17' };
    const ids = { householdId: 'home', purchaseId: 'purchase', itemId: 'product' };
    await purchasesService.createItem({ ...ids, body });
    await purchasesService.updateItem({ ...ids, body });
    await purchasesService.deleteItem(ids);
    expect(http.post).toHaveBeenCalledWith('/households/home/purchases/purchase/items', body);
    expect(http.patch).toHaveBeenCalledWith('/households/home/purchases/purchase/items/product', body);
    expect(http.delete).toHaveBeenCalledWith('/households/home/purchases/purchase/items/product');
  });

  it('transmite la pérdida de acceso sin intentar leer el nuevo detalle', async () => {
    http.patch.mockResolvedValue({ id: 'purchase', accessRevoked: true });
    await expect(purchasesService.update({ householdId: 'home', purchaseId: 'purchase', body: {} })).resolves.toEqual({ id: 'purchase', accessRevoked: true });
    expect(http.get).not.toHaveBeenCalled();
  });
});

describe('purchases query isolation', () => {
  it('separa hogares y compras por identificador', () => {
    expect(queryKeys.purchases.all('a')).not.toEqual(queryKeys.purchases.all('b'));
    expect(queryKeys.purchases.detail('a', 'one')).not.toEqual(queryKeys.purchases.detail('a', 'two'));
    expect(queryKeys.purchases.detail('a', 'one')).not.toEqual(queryKeys.purchases.detail('b', 'one'));
  });

  it('invalida compra y finanzas del hogar, no otros hogares ni saldos o gastos artificiales', async () => {
    const client = new QueryClient();
    const affected = [queryKeys.purchases.all('a'), queryKeys.purchases.detail('a', 'one'), queryKeys.purchases.documents('a', 'one'), queryKeys.dashboard('a', 'current'), queryKeys.budget('a'), ['calendar', 'a', 'MONTH'], ['simulation', 'a', 3], ['plannings', 'a'], ['monthlyPlanning', 'a', '2026-09']];
    const unaffected = [
      queryKeys.purchases.all('b'), queryKeys.purchases.detail('a', 'two'),
      queryKeys.purchases.documents('b', 'one'), queryKeys.purchases.documents('a', 'two'),
      queryKeys.dashboard('b', 'current'), queryKeys.budget('b'), queryKeys.accounts('a'),
      queryKeys.oneTimeExpenses('a'), queryKeys.recurringExpenses.all('a'), queryKeys.invoices.all('a'),
    ];
    for (const key of [...affected, ...unaffected]) client.setQueryData(key, { unchanged: true });
    await invalidatePurchaseQueries(client, 'a', 'one');
    for (const key of affected) expect(client.getQueryState(key).isInvalidated).toBe(true);
    for (const key of unaffected) {
      expect(client.getQueryState(key).isInvalidated).toBe(false);
      expect(client.getQueryData(key)).toEqual({ unchanged: true });
    }
    client.clear();
  });

  it('al crear sin detalle abierto invalida el listado y todas las vistas financieras', async () => {
    const client = { invalidateQueries: vi.fn().mockResolvedValue(undefined) };
    await invalidatePurchaseQueries(client, 'a');
    expect(client.invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual(expect.arrayContaining([
      ['purchases', 'a'], ['budget', 'a'], ['dashboard', 'a'], ['calendar', 'a'], ['simulation', 'a'], ['plannings', 'a'], ['monthlyPlanning', 'a'],
    ]));
    expect(client.invalidateQueries).toHaveBeenCalledTimes(7);
  });
});
