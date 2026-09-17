import {
  DOCUMENT_ACCEPT,
  DOCUMENT_CONTENT_TYPES,
  DOCUMENT_MAX_BYTES,
  getDocumentContentType,
} from '../documents/documentFiles';

export { formatDocumentSize } from '../documents/documentFiles';
export const MAX_PURCHASE_DOCUMENT_BYTES = DOCUMENT_MAX_BYTES;
export const PURCHASE_DOCUMENT_ACCEPT = DOCUMENT_ACCEPT;
export const getPurchaseDocumentContentType = getDocumentContentType;
export const PURCHASE_DOCUMENT_TYPES = Object.freeze([
  { value: 'RECEIPT', label: 'Ticket' },
  { value: 'INVOICE', label: 'Factura' },
  { value: 'WARRANTY', label: 'Garantía' },
  { value: 'OTHER', label: 'Otro' },
]);

export function validatePurchaseDocumentFile(file) {
  if (typeof File === 'undefined' || !(file instanceof File)) return 'Selecciona un archivo.';
  if (!file.name.trim()) return 'El archivo debe tener un nombre.';
  if (!DOCUMENT_CONTENT_TYPES.includes(getDocumentContentType(file))) return 'Solo se admiten archivos PDF, JPEG, PNG o WebP.';
  if (file.size === 0) return 'El archivo está vacío. Selecciona un archivo que contenga datos.';
  if (file.size > MAX_PURCHASE_DOCUMENT_BYTES) return 'El archivo supera el tamaño máximo permitido.';
  return null;
}
