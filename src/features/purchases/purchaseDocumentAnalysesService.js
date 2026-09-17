import { http } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { invalidatePurchaseFinancialQueries } from './invalidatePurchaseFinancialQueries';

const path = ({ householdId, purchaseId, documentId }) => `/households/${encodeURIComponent(householdId)}/purchases/${encodeURIComponent(purchaseId)}/documents/${encodeURIComponent(documentId)}`;

export const purchaseDocumentAnalysesService = {
  list: ({ signal, ...ids }) => http.get(`${path(ids)}/analyses`, { signal }),
  // No provider SDK, document bytes or credentials leave the application API.
  // An analysis is a paid operation: never retry it automatically here.
  analyze: (ids) => http.post(`${path(ids)}/analyze`, { consent: true }, { timeout: 120_000 }),
  confirm: ({ analysisId, body, ...ids }) => http.post(`${path(ids)}/analyses/${encodeURIComponent(analysisId)}/confirm`, body),
};

export function invalidatePurchaseAnalysisConfirmation(queryClient, householdId, purchaseId, documentId, { active = true } = {}) {
  return Promise.all([
    invalidatePurchaseFinancialQueries(queryClient, householdId, { active }),
    ...[
      queryKeys.purchases.all(householdId),
      queryKeys.purchases.detail(householdId, purchaseId),
      queryKeys.purchases.documents(householdId, purchaseId),
      queryKeys.purchases.analyses(householdId, purchaseId, documentId),
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey, exact: true, ...(!active ? { refetchType: 'none' } : {}) })),
  ]);
}
