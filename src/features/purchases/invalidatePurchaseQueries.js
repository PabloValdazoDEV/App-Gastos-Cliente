import { queryKeys } from '../../api/queryKeys';
import { invalidatePurchaseFinancialQueries } from './invalidatePurchaseFinancialQueries';

export function invalidatePurchaseQueries(queryClient, householdId, purchaseId) {
  // A purchase stays in its own domain; its payment plan is a financial source.
  // Product edits can also change the labels shown in financial breakdowns.
  return Promise.all([
    invalidatePurchaseFinancialQueries(queryClient, householdId),
    queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all(householdId), exact: true }),
    ...(purchaseId ? [
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.detail(householdId, purchaseId), exact: true }),
      // Removing a product preserves its documents at purchase level.
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.documents(householdId, purchaseId), exact: true }),
    ] : []),
  ]);
}
