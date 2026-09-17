import { useEffect, useId, useRef, useState } from 'react';

import { SelectField } from '../../pages/expensePageShared';
import { AuthError, SubmitButton } from '../auth/components/AuthFeedback';
import {
  MAX_PURCHASE_DOCUMENT_BYTES,
  PURCHASE_DOCUMENT_ACCEPT,
  PURCHASE_DOCUMENT_TYPES,
  formatDocumentSize,
  validatePurchaseDocumentFile,
} from './purchaseDocumentSchema';

export function PurchaseDocumentForm({ items, initialDocument = null, isPending, error, onSubmit, onCancel }) {
  const id = useId();
  const fileRef = useRef(null);
  const formRef = useRef(null);
  const submittingRef = useRef(false);
  const [file, setFile] = useState(null);
  const [type, setType] = useState(initialDocument?.type ?? 'RECEIPT');
  const [related, setRelated] = useState(initialDocument?.purchaseItemId ? 'ITEM' : 'PURCHASE');
  const [itemId, setItemId] = useState(initialDocument?.purchaseItemId ?? '');
  const [errors, setErrors] = useState({});
  const editing = Boolean(initialDocument);

  useEffect(() => { formRef.current?.querySelector('input, select')?.focus(); }, []);

  async function submit(event) {
    event.preventDefault();
    if (submittingRef.current || isPending) return;
    const nextErrors = {};
    if (!editing) {
      const fileError = file ? validatePurchaseDocumentFile(file) : 'Selecciona un archivo.';
      if (fileError) nextErrors.file = fileError;
    }
    if (related === 'ITEM' && !items.some((item) => item.id === itemId)) {
      nextErrors.item = 'Selecciona un producto de esta compra.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (nextErrors.file) fileRef.current?.focus();
      else formRef.current?.querySelector('select[name="purchaseItemId"]')?.focus();
      return;
    }
    submittingRef.current = true;
    try {
      await onSubmit({ ...(editing ? {} : { file }), type, purchaseItemId: related === 'ITEM' ? itemId : null });
    } catch {
      // The parent retains the normalized mutation error without clearing inputs.
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <form aria-label={editing ? 'Editar documento' : 'Añadir documento'} aria-busy={isPending || undefined} className="min-w-0 space-y-5 rounded-2xl border border-border bg-surface-muted p-4 sm:p-5" noValidate onSubmit={submit} ref={formRef}>
      <h3 className="text-lg font-extrabold">{editing ? 'Editar documento' : 'Añadir documento'}</h3>
      {editing ? <p className="min-w-0 break-words text-sm text-text-muted [overflow-wrap:anywhere]">{initialDocument.filename}</p> : (
        <div className="min-w-0">
          <label className="mb-1.5 block text-sm font-bold" htmlFor={`${id}-file`}>Archivo</label>
          <p className="mb-2 text-sm leading-6 text-text-muted" id={`${id}-help`}>PDF, JPEG, PNG o WebP · máximo {formatDocumentSize(MAX_PURCHASE_DOCUMENT_BYTES)} por archivo. Puedes seleccionar un archivo o una foto desde tu dispositivo.</p>
          <input accept={PURCHASE_DOCUMENT_ACCEPT} aria-describedby={`${id}-help${errors.file ? ` ${id}-file-error` : ''}`} aria-invalid={Boolean(errors.file)} className="block min-h-12 w-full min-w-0 max-w-full cursor-pointer rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-bold file:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60" disabled={isPending} id={`${id}-file`} onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            const fileError = selected ? validatePurchaseDocumentFile(selected) : null;
            setFile(fileError ? null : selected);
            setErrors((previous) => ({ ...previous, file: fileError }));
            if (fileError) event.target.value = '';
          }} ref={fileRef} type="file" />
          {file ? <p className="mt-2 break-words text-sm text-text-muted [overflow-wrap:anywhere]">{file.name} · {formatDocumentSize(file.size)}</p> : null}
          {errors.file ? <p className="mt-2 break-words text-sm font-medium text-red-700 [overflow-wrap:anywhere]" id={`${id}-file-error`} role="alert">{errors.file}</p> : null}
        </div>
      )}
      <SelectField disabled={isPending} label="Tipo" name="documentType" onChange={(event) => setType(event.target.value)} value={type}>
        {PURCHASE_DOCUMENT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </SelectField>
      <fieldset className="min-w-0" disabled={isPending}>
        <legend className="mb-2 text-sm font-bold">Relacionado con</legend>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {[['PURCHASE', 'Compra completa'], ['ITEM', 'Producto concreto']].map(([value, label]) => (
            <label className={`flex min-h-12 min-w-0 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-bold ${related === value ? 'border-brand bg-brand-soft text-brand-strong' : 'border-border-strong bg-surface'}`} key={value}>
              <input checked={related === value} className="size-5 shrink-0 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" name={`${id}-related`} onChange={() => { setRelated(value); setErrors((previous) => ({ ...previous, item: null })); }} type="radio" value={value} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {related === 'ITEM' ? <SelectField disabled={isPending} error={errors.item} label="Producto" name="purchaseItemId" onChange={(event) => { setItemId(event.target.value); setErrors((previous) => ({ ...previous, item: null })); }} value={itemId}>
        <option value="">Selecciona un producto</option>
        {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </SelectField> : null}
      <AuthError error={error} />
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 sm:flex-1"><SubmitButton isPending={isPending} pendingLabel={editing ? 'Guardando cambios…' : 'Subiendo documento…'}>{editing ? 'Guardar cambios del documento' : 'Subir documento'}</SubmitButton></div>
        <button className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-bold hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60" disabled={isPending} onClick={onCancel} type="button">Cancelar</button>
      </div>
    </form>
  );
}
