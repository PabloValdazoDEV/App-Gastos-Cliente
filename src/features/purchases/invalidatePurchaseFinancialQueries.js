import { queryKeys } from '../../api/queryKeys';

// Purchase payment plans feed the standard calculators. Prefix invalidation
// refreshes every month/view without reloading or touching another household.
export function invalidatePurchaseFinancialQueries(queryClient, householdId, { active = true } = {}) {
  return Promise.all([
    queryKeys.budget(householdId),
    ['dashboard', householdId],
    ['calendar', householdId],
    ['simulation', householdId],
    ['plannings', householdId],
    queryKeys.monthlyPlanning.all(householdId),
  ].map((queryKey) => queryClient.invalidateQueries({ queryKey, ...(!active ? { refetchType: 'none' } : {}) })));
}
