import { http } from '../../api/client';
import { publicEnv } from '../../config/env';
import { getPurchaseDocumentContentType } from './purchaseDocumentSchema';

const collection = ({ householdId, purchaseId }) => `/households/${encodeURIComponent(householdId)}/purchases/${encodeURIComponent(purchaseId)}/documents`;
const documentPath = (args) => `${collection(args)}/${encodeURIComponent(args.documentId)}`;
const DOCUMENT_TIMEOUT_MS = 60_000;

export const purchaseDocumentsService = {
  list: ({ signal, ...ids }) => http.get(collection(ids), ...(signal ? [{ signal }] : [])),
  upload: ({ file, type, purchaseItemId = null, ...ids }) => http.post(collection(ids), file, {
    headers: {
      'Content-Type': getPurchaseDocumentContentType(file),
      'X-Document-Filename': encodeURIComponent(file.name),
    },
    params: { type, ...(purchaseItemId ? { purchaseItemId } : {}) },
    timeout: DOCUMENT_TIMEOUT_MS,
  }),
  content: (args) => http.get(`${documentPath(args)}/content`, {
    responseType: 'blob', timeout: DOCUMENT_TIMEOUT_MS,
  }),
  // This URL still requires authentication and purchase authorization on every
  // request. Native PDF viewing keeps the server's sandbox/security headers.
  contentUrl: ({ disposition = 'inline', ...ids }) => `${publicEnv.apiUrl.replace(/\/+$/, '')}${documentPath(ids)}/content?disposition=${disposition === 'inline' ? 'inline' : 'attachment'}`,
  update: ({ body, ...ids }) => http.patch(documentPath(ids), body),
  remove: (args) => http.delete(documentPath(args)),
};
