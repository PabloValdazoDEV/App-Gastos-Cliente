import { queryKeys } from '../../api/queryKeys';

// Prefixes also refresh every date/balance variant of the simulator/dashboard.
export function invalidateBudgetQueries(queryClient, householdId) {
  return Promise.all([
    queryKeys.budget(householdId),
    queryKeys.budgetMarginPreferences(householdId),
    queryKeys.invoiceStatistics(householdId),
    queryKeys.variableStatistics(householdId),
    ['dashboard', householdId],
    ['simulation', householdId],
    ['plannings', householdId],
    queryKeys.monthlyPlanning.all(householdId),
  ].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
