import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../../api/queryKeys';
import { invalidateBudgetQueries } from './invalidateBudgetQueries';
import { invalidatePaymentQueries } from './paymentOccurrence';

describe('financial invalidation contracts', () => {
  it.each([
    ['budget mutation', (client) => invalidateBudgetQueries(client, 'home')],
    ['payment creation or correction', (client) => invalidatePaymentQueries(client, 'home', 'expense')],
  ])('%s invalidates all Dashboard periods and planning, never another household', async (_name, invalidate) => {
    const client = new QueryClient();
    const keys = [
      queryKeys.dashboard('home', '2026-12'),
      queryKeys.dashboard('home', '2027-01'),
      queryKeys.dashboard('home', 'planning'),
      queryKeys.budget('home'),
      ['simulation', 'home', '2026-12-31', 123_000],
      ['plannings', 'home'],
      queryKeys.monthlyPlanning.detail('home', '2027-01'),
    ];
    const otherHome = queryKeys.dashboard('other-home', '2027-01');
    for (const key of [...keys, otherHome]) client.setQueryData(key, { cached: true });

    await invalidate(client);

    for (const key of keys) expect(client.getQueryState(key).isInvalidated).toBe(true);
    expect(client.getQueryState(otherHome).isInvalidated).toBe(false);
    client.clear();
  });

  it('refetches an active Dashboard after the common payment invalidation without doing financial calculations in the client', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    const key = queryKeys.dashboard('home', '2026-09');
    const first = { monthlyProgress: { common: { budgetCents: 120_000, usedCents: 58_000, remainingCents: 62_000 } } };
    const updated = { monthlyProgress: { common: { budgetCents: 120_000, usedCents: 62_000, remainingCents: 58_000 } } };
    client.setQueryData(key, first);
    const fetchDashboard = vi.fn().mockResolvedValue(updated);
    const observer = new QueryObserver(client, { queryKey: key, queryFn: fetchDashboard });
    const unsubscribe = observer.subscribe(() => {});
    expect(fetchDashboard).not.toHaveBeenCalled();

    await invalidatePaymentQueries(client, 'home', 'expense');

    expect(fetchDashboard).toHaveBeenCalledOnce();
    expect(client.getQueryData(key)).toEqual(updated);
    unsubscribe();
    client.clear();
  });
});
