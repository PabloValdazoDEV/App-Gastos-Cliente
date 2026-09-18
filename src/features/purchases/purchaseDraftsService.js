import { http } from '../../api/client';
import { getPurchaseDocumentContentType } from './purchaseDocumentSchema';

const collection = (householdId) => `/households/${encodeURIComponent(householdId)}/purchase-drafts`;
const path = ({ householdId, draftId }) => `${collection(householdId)}/${encodeURIComponent(draftId)}`;
export const purchaseDraftsService = {
  list: (householdId) => http.get(collection(householdId)),
  get: (ids) => http.get(path(ids)),
  upload: ({ householdId, file }) => http.post(collection(householdId), file, {
    headers: { 'Content-Type': getPurchaseDocumentContentType(file), 'X-Document-Filename': encodeURIComponent(file.name) },
    timeout: 60_000,
  }),
  analyze: (ids) => http.post(`${path(ids)}/analyze`, { consent: true }, { timeout: 90_000 }),
  confirm: ({ body, ...ids }) => http.post(`${path(ids)}/confirm`, body),
  remove: (ids) => http.delete(path(ids)),
};
