import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { purchasesService } from './purchasesService';

export function linkedPurchaseExpenses(purchases = [], kind) {
  return purchases.filter((purchase) => !purchase.archivedAt && (kind === 'RECURRING'
    ? purchase.paymentMethod === 'FINANCED' && purchase.financing
    : purchase.paymentMethod !== 'FINANCED' || purchase.financing?.downPaymentCents > 0));
}

export function useLinkedPurchaseExpenses(householdId) {
  return useQuery({ queryKey: queryKeys.purchases.all(householdId), queryFn: () => purchasesService.list(householdId), enabled: Boolean(householdId) });
}
