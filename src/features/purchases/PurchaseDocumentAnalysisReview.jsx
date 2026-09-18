import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';

import { AuthError, SubmitButton } from '../auth/components/AuthFeedback';
import { FormField } from '../auth/components/FormField';
import { formatCents } from '../finance/money';
import { focusPurchaseFormError, MAX_PURCHASE_ITEMS } from './purchaseFormState';
import { analysisItemDefaults, analysisReviewDefaults, analysisReviewMismatch, analysisReviewPayload, analysisReviewSchema, analysisTotalProtected } from './purchaseAnalysisReviewState';

function CheckField({ label, help, error, ...props }) {
  const id = useId();
  return <div className="min-w-0"><label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-2 text-sm font-semibold" htmlFor={id}><input aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined} aria-invalid={Boolean(error)} className="mt-0.5 size-5 shrink-0 accent-brand" id={id} type="checkbox" {...props} /><span>{label}</span></label>{help ? <p className="ml-8 text-sm leading-5 text-text-muted" id={`${id}-help`}>{help}</p> : null}{error ? <p className="text-sm text-red-700" id={`${id}-error`} role="alert">{error}</p> : null}</div>;
}
const reviewHelp = (confidence) => ['LOW', 'MEDIUM'].includes(confidence) ? 'Revisar · la confianza de la IA es orientativa.' : undefined;
const actionClass = 'inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-2 rounded-xl border border-border-strong px-3 py-2.5 text-sm font-bold hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60';

export function PurchaseDocumentAnalysisReview({ analysis, purchase, currency = 'EUR', error, isPending = false, isStale = false, disabled = false, onSubmit, onCancel, onDirtyChange }) {
  const formRef = useRef(null);
  const addRef = useRef(null);
  const lockRef = useRef(false);
  const data = analysis.extractedData;
  const protectedTotal = analysisTotalProtected(purchase);
  const { control, register, handleSubmit, setValue, formState: { errors, isDirty, isSubmitting } } = useForm({
    defaultValues: analysisReviewDefaults(analysis, purchase, currency),
    resolver: zodResolver(analysisReviewSchema(purchase, currency)), shouldFocusError: false,
  });
  const values = useWatch({ control });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const pending = isPending || isSubmitting;
  const mismatch = analysisReviewMismatch(values);
  const amountsSignature = JSON.stringify([values.total, values.items.map((item) => item.totalPrice)]);
  useEffect(() => { formRef.current?.querySelector('input:not([readonly])')?.focus(); }, []);
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);
  useEffect(() => { setValue('acknowledgeTotalMismatch', false); }, [amountsSignature, setValue]);
  useEffect(() => { if (protectedTotal) setValue('applyTotal', false); }, [protectedTotal, setValue]);
  const submit = handleSubmit(async (validValues) => {
    if (pending || disabled || isStale || lockRef.current) return;
    lockRef.current = true;
    try { await onSubmit(analysisReviewPayload(validValues, analysis)); }
    catch { /* The workspace displays safe errors without discarding edits. */ }
    finally { lockRef.current = false; }
  }, () => requestAnimationFrame(() => focusPurchaseFormError(formRef.current)));

  return <form aria-busy={pending} aria-label="Revisar datos detectados" className="min-w-0 space-y-6 [overflow-wrap:anywhere]" noValidate onSubmit={submit} ref={formRef}>
    <div><h3 className="text-xl font-extrabold">Revisar datos detectados</h3><p className="mt-2 text-sm leading-6 text-text-muted">Comprueba la información antes de guardarla. La IA puede cometer errores.</p><p className="mt-1 text-xs leading-5 text-text-muted">El documento original se conserva. Nada se aplica a la compra hasta pulsar «Confirmar datos».</p></div>
    {data.warnings?.length ? <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">Revisa estas observaciones</p><ul className="mt-2 list-disc space-y-1 pl-5">{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div> : null}
    <fieldset className="min-w-0 space-y-4" disabled={pending || disabled}>
      <legend className="mb-3 text-lg font-bold">Compra</legend>
      <FormField autoComplete="organization" error={errors.merchant?.message} help={[reviewHelp(data.merchant?.confidence), data.merchant?.name == null ? 'No detectado: se conserva el comercio actual, si existe.' : null].filter(Boolean).join(' ') || undefined} label="Comercio" maxLength={200} {...register('merchant')} />
      <CheckField label="Aplicar el comercio revisado" {...register('applyMerchant')} />
      <div className="date-fields-grid grid min-w-0 gap-4">
        <FormField error={errors.purchaseDate?.message} help={[reviewHelp(data.purchaseDate?.confidence), data.purchaseDate?.value == null ? 'No detectada: se conserva la fecha actual. Puedes corregirla.' : null].filter(Boolean).join(' ') || undefined} label="Fecha de compra" type="date" {...register('purchaseDate')} />
        <FormField error={errors.total?.message} help={protectedTotal ? 'No se aplicará: el precio está protegido porque hay cuotas pagadas. Los pagos y su historial no cambian.' : data.totalCents == null ? 'No detectado: se conserva el precio actual.' : 'Es el precio de compra, no un nuevo pago.'} inputMode="decimal" label={protectedTotal ? 'Total detectado (no se aplicará)' : `Total (${currency === 'EUR' ? '€' : currency})`} readOnly={protectedTotal} {...register('total')} />
      </div>
      <CheckField label="Aplicar la fecha revisada" help="Las garantías registradas por duración se recalculan con la fecha de compra, como en la edición habitual." {...register('applyPurchaseDate')} />
      {!protectedTotal ? <CheckField error={errors.applyTotal?.message} label="Aplicar el total revisado como precio de compra" help="No registra pagos ni cambia la forma de pago. En compras financiadas, se aplican las reglas de financiación existentes." {...register('applyTotal')} /> : null}
      <FormField error={errors.currency?.message} help="No se realiza conversión de divisas. Para aplicar importes debe coincidir con la moneda del hogar." label="Moneda de revisión" maxLength={3} {...register('currency')} />
    </fieldset>
    <fieldset className="min-w-0 space-y-4" disabled={pending || disabled}>
      <legend className="mb-3 text-lg font-bold">Productos</legend>
      <p className="text-sm leading-6 text-text-muted">{purchase.singleProduct ? 'Esta compra corresponde a un solo producto. Los productos del documento se muestran como referencia; para guardar otro producto, crea otra compra. Se conserva el precio actual hasta que decidas corregirlo.' : `Los ${purchase.items?.length ?? 0} productos existentes se conservan, con sus garantías y documentos. Aquí corriges los productos detectados; puedes añadirlos como nuevos, sin reemplazar los existentes.`}</p>
      {fields.length ? <ol className="min-w-0 space-y-4">{fields.map((field, index) => <li className="min-w-0 space-y-4 rounded-xl border border-border bg-surface p-4" key={field.id}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><h4 className="font-bold">Producto detectado {index + 1}</h4>{reviewHelp(field.confidence) ? <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900">Revisar</span> : null}</div>
        <FormField error={errors.items?.[index]?.name?.message} label={`Nombre del producto ${index + 1}`} maxLength={200} {...register(`items.${index}.name`)} />
        <div className="grid min-w-0 gap-4 sm:grid-cols-2"><FormField error={errors.items?.[index]?.quantity?.message} help="Si no se detectó, indica la cantidad antes de añadir el producto." inputMode="numeric" label={`Cantidad del producto ${index + 1}`} {...register(`items.${index}.quantity`)} /><FormField error={errors.items?.[index]?.totalPrice?.message} inputMode="decimal" label={`Total de la línea ${index + 1} (${currency === 'EUR' ? '€' : currency})`} {...register(`items.${index}.totalPrice`)} /></div>
        <details className="min-w-0"><summary className="min-h-11 cursor-pointer py-2.5 text-sm font-bold text-brand-strong">Más datos del producto {index + 1}</summary><div className="grid min-w-0 gap-4 pt-3 sm:grid-cols-2"><FormField error={errors.items?.[index]?.unitPrice?.message} inputMode="decimal" label={`Precio unitario del producto ${index + 1}`} {...register(`items.${index}.unitPrice`)} /><FormField error={errors.items?.[index]?.brand?.message} label={`Marca del producto ${index + 1}`} maxLength={120} {...register(`items.${index}.brand`)} /><FormField error={errors.items?.[index]?.model?.message} label={`Modelo del producto ${index + 1}`} maxLength={120} {...register(`items.${index}.model`)} /></div></details>
        <button aria-label={`Eliminar producto detectado ${index + 1}`} className={`${actionClass} text-red-800`} onClick={() => { remove(index); requestAnimationFrame(() => addRef.current?.focus()); }} type="button"><Trash2 aria-hidden="true" className="size-4 shrink-0" />Eliminar de la revisión</button>
      </li>)}</ol> : <p className="rounded-xl border border-dashed border-border-strong p-4 text-sm text-text-muted">No hay productos en esta revisión. Puedes añadirlos o conservar solo los datos de la compra.</p>}
      <button className={actionClass} disabled={fields.length >= MAX_PURCHASE_ITEMS} onClick={() => append(analysisItemDefaults(), { focusName: `items.${fields.length}.name` })} ref={addRef} type="button"><Plus aria-hidden="true" className="size-4 shrink-0" />Añadir producto a la revisión</button>
      {!purchase.singleProduct ? <CheckField error={errors.applyItems?.message} help="Se añadirán como nuevos productos. No se borrarán ni reemplazarán los que ya tienes. Revisa que no estén duplicados." label="Añadir estos productos a la compra" {...register('applyItems')} /> : null}
    </fieldset>
    <section aria-label="Información detectada" className="min-w-0 rounded-xl bg-surface-muted p-4"><h4 className="font-bold">Información detectada</h4><p className="mt-1 text-xs leading-5 text-text-muted">Se conserva en el análisis; no crea campos financieros ni pagos.</p><dl className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">{[['Subtotal', formatCents(data.subtotalCents, data.currency ?? currency)], ['IVA', formatCents(data.taxCents, data.currency ?? currency)], ['Descuento', formatCents(data.discountCents, data.currency ?? currency)], ['Número de documento', data.documentNumber ?? 'No detectado']].map(([label, value]) => <div className="min-w-0" key={label}><dt className="text-xs text-text-muted">{label}</dt><dd className="mt-1 text-sm font-bold">{value === '—' ? 'No detectado' : value}</dd></div>)}</dl></section>
    {mismatch ? <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><p className="text-sm font-semibold" role="status">El total detectado no coincide con la suma de los productos. Revísalo antes de guardar.</p><CheckField disabled={pending || disabled} error={errors.acknowledgeTotalMismatch?.message} label="He revisado la diferencia y quiero guardar estos datos" {...register('acknowledgeTotalMismatch')} /></div> : null}
    <AuthError error={error} />
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row"><div className="min-w-0 sm:flex-1"><SubmitButton disabled={isStale || disabled} isPending={pending} pendingLabel="Confirmando datos…">Confirmar datos</SubmitButton></div><button className={actionClass} disabled={pending || disabled} onClick={onCancel} type="button">Cancelar revisión</button></div>
    <p className="text-xs leading-5 text-text-muted">Cancelar descarta solo los cambios de esta revisión. El análisis guardado y el documento original se conservan.</p>
  </form>;
}
