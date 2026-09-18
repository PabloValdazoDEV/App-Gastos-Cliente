import { zodResolver } from '@hookform/resolvers/zod';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';

import { AuthError, SubmitButton } from '../auth/components/AuthFeedback';
import { PurchaseItemFields } from './PurchaseItemFields';
import { focusPurchaseFormError, purchaseItemDefaults, purchaseItemFormSchema, purchaseItemPayload } from './purchaseFormState';

export function PurchaseItemForm({ initialItem = null, purchaseDate, onSubmit, onCancel, isPending = false, error = null, currency = 'EUR', singleProduct = false }) {
  const formRef = useRef(null);
  const { register, watch, setValue, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: purchaseItemDefaults(initialItem),
    resolver: zodResolver(purchaseItemFormSchema),
    mode: 'onChange',
    shouldFocusError: false,
  });
  const pending = isPending || isSubmitting;
  const submit = handleSubmit(async (values) => {
    if (pending) return;
    try {
      await onSubmit(purchaseItemPayload(values));
    } catch {
      // Errors are normalized by the owning page and remain visible below.
    }
  }, () => requestAnimationFrame(() => focusPurchaseFormError(formRef.current)));

  return (
    <form aria-busy={pending} aria-label={initialItem ? 'Editar producto' : 'Añadir producto'} className="min-w-0 max-w-full space-y-5" noValidate onSubmit={submit} ref={formRef}>
      <PurchaseItemFields setValue={setValue} singleProduct={singleProduct} currency={currency} disabled={pending} errors={errors} purchaseDate={purchaseDate} register={register} watch={watch} />
      {singleProduct ? <p className="text-sm text-text-muted">El precio se modifica en «Editar compra» y se mantiene sincronizado con este producto.</p> : null}
      <AuthError error={error} />
      <SubmitButton isPending={pending} pendingLabel="Guardando producto…">{initialItem ? 'Guardar cambios del producto' : 'Guardar producto'}</SubmitButton>
      <button className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border-strong px-4 py-2.5 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60" disabled={pending} onClick={onCancel} type="button">Cancelar</button>
    </form>
  );
}
