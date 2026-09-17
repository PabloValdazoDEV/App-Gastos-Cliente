import { http } from '../../api/client';

const collection = (householdId) => `/households/${encodeURIComponent(householdId)}/purchases`;
const purchase = (householdId, purchaseId) => `${collection(householdId)}/${encodeURIComponent(purchaseId)}`;
const item = (householdId, purchaseId, itemId) => `${purchase(householdId, purchaseId)}/items/${encodeURIComponent(itemId)}`;

// The plan feeds financial calculations directly, without fake expense records
// or automatic changes to registered bank-account balances.
export const purchasesService = {
  list: (householdId) => http.get(collection(householdId)),
  detail: ({ householdId, purchaseId, signal }) => http.get(purchase(householdId, purchaseId), ...(signal ? [{ signal }] : [])),
  create: ({ householdId, body }) => http.post(collection(householdId), body),
  update: ({ householdId, purchaseId, body }) => http.patch(purchase(householdId, purchaseId), body),
  archive: ({ householdId, purchaseId }) => http.delete(purchase(householdId, purchaseId)),
  createItem: ({ householdId, purchaseId, body }) => http.post(`${purchase(householdId, purchaseId)}/items`, body),
  updateItem: ({ householdId, purchaseId, itemId, body }) => http.patch(item(householdId, purchaseId, itemId), body),
  deleteItem: ({ householdId, purchaseId, itemId }) => http.delete(item(householdId, purchaseId, itemId)),
};
