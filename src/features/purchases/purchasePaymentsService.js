import { http } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { invalidatePurchaseFinancialQueries } from './invalidatePurchaseFinancialQueries';

const installmentPath = ({ householdId, purchaseId, installmentId }) => `/households/${encodeURIComponent(householdId)}/purchases/${encodeURIComponent(purchaseId)}/installments/${encodeURIComponent(installmentId)}`;

// Purchase payments have their own endpoints; never use ExpensePayment here.
export const purchasePaymentsService = {
  pay: ({ body, ...ids }) => http.post(`${installmentPath(ids)}/pay`, body),
  correct: ({ body, ...ids }) => http.patch(`${installmentPath(ids)}/payment`, body),
  revert: (ids) => http.delete(`${installmentPath(ids)}/payment`, { data: { confirm: true } }),
};

export function invalidatePurchasePaymentQueries(queryClient, householdId, purchaseId, { active = true } = {}) {
  return Promise.all([
    invalidatePurchaseFinancialQueries(queryClient, householdId, { active }),
    ...[queryKeys.purchases.all(householdId), queryKeys.purchases.detail(householdId, purchaseId)]
      .map((queryKey) => queryClient.invalidateQueries({ queryKey, exact: true, ...(!active ? { refetchType: 'none' } : {}) })),
  ]);
}
