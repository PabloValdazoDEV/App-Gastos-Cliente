import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { SelectField, TextareaField } from '../../pages/expensePageShared';
import { AuthError, SubmitButton } from '../auth/components/AuthFeedback';
import { FormField } from '../auth/components/FormField';
import { PurchaseItemFields } from './PurchaseItemFields';
import { PurchaseConfirmation } from './PurchaseConfirmation';
import { PurchasePaymentFields } from './PurchasePaymentFields';
import { hasRecordedFinancingPayments, purchasePaymentNeedsReset } from './purchasePaymentForm';
import {
  focusPurchaseFormError, isValidSplit, MAX_PURCHASE_ITEMS, purchaseDefaults,
  purchaseFormSchema, purchaseItemDefaults, purchasePayload, splitTotalBps,
} from './purchaseFormState';

const secondaryButton = 'inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-border-strong px-4 py-2.5 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';
const percentage = (value) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value / 100);

export function PurchaseForm({ people = [], initialPurchase = null, initialValues, intakeHints = {}, singleProduct = false, onSubmit, onCancel, isPending = false, error = null, currency = 'EUR', timezone }) {
  const editing = Boolean(initialPurchase);
  const formRef = useRef(null);
  const pendingFocus = useRef(null);
  const submitLock = useRef(false);
  const [paymentConfirmation, setPaymentConfirmation] = useState(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const id = useId();
  const { register, control, watch, handleSubmit, setFocus, setValue, getFieldState, formState: { errors, isSubmitting } } = useForm({
    defaultValues: initialValues ?? purchaseDefaults(initialPurchase),
    resolver: zodResolver(purchaseFormSchema({ editing, initialPurchase, timezone })),
    mode: 'onChange',
    shouldFocusError: false,
  });
  const items = useFieldArray({ control, name: 'items' });
  const shares = useFieldArray({ control, name: 'shares' });
  const ownership = watch('ownershipType');
  // Historical owners can remain on an unchanged purchase even after leaving
  // the active people list. Never offer them when choosing a different scope.
  const ownershipPeople = [...people];
  if (initialPurchase?.ownershipType === ownership) {
    const historicalPeople = ownership === 'PERSONAL'
      ? [initialPurchase.personalPerson]
      : ownership === 'SPLIT' ? initialPurchase.shares?.map((share) => share.householdPerson) ?? [] : [];
    for (const person of historicalPeople) {
      if (person && !ownershipPeople.some((candidate) => candidate.id === person.id)) {
        ownershipPeople.push({ id: person.id, name: `${person.name} (inactiva)` });
      }
    }
  }
  const shareValues = watch('shares');
  const total = splitTotalBps(shareValues);
  const purchaseDate = watch('purchaseDate');
  const purchaseTotal = watch('total');
  const paidHistory = hasRecordedFinancingPayments(initialPurchase);
  const pending = isPending || isSubmitting || confirmPending;
  const splitInvalid = ownership === 'SPLIT' && !isValidSplit(shareValues);

  useEffect(() => {
    if (!initialPurchase?.paymentDate && !getFieldState('paymentDate').isDirty) setValue('paymentDate', purchaseDate);
    if (!initialPurchase?.financing?.downPaymentPaidAt && !getFieldState('downPaymentPaidAt').isDirty) setValue('downPaymentPaidAt', purchaseDate);
  }, [purchaseDate, initialPurchase, getFieldState, setValue]);
  useEffect(() => {
    if (initialPurchase?.paidAmountCents == null && !getFieldState('paidAmount').isDirty) setValue('paidAmount', purchaseTotal);
  }, [purchaseTotal, initialPurchase, getFieldState, setValue]);

  useEffect(() => {
    if (pendingFocus.current) {
      setFocus(pendingFocus.current);
      pendingFocus.current = null;
    }
  }, [items.fields.length, shares.fields.length, setFocus]);

  function removeProduct(index) {
    if (items.fields.length <= 1) return;
    pendingFocus.current = `items.${Math.min(index, items.fields.length - 2)}.name`;
    items.remove(index);
  }

  function removeShare(index) {
    pendingFocus.current = `shares.${Math.min(index, shares.fields.length - 2)}.householdPersonId`;
    shares.remove(index);
  }

  const submit = handleSubmit(async (values) => {
    if (pending || splitInvalid || submitLock.current || paymentConfirmation) return;
    const body = purchasePayload(values, { editing, initialPurchase });
    if (singleProduct && !editing) {
      body.singleProduct = true;
      body.items = [{ ...body.items[0], priceCents: body.totalCents }];
    }
    if (purchasePaymentNeedsReset(values, initialPurchase)) {
      setPaymentConfirmation(body);
      return;
    }
    submitLock.current = true;
    try {
      await onSubmit(body);
    } catch {
      // The page owns mutation errors and supplies the normalized error prop.
    } finally { submitLock.current = false; }
  }, () => requestAnimationFrame(() => focusPurchaseFormError(formRef.current)));

  async function confirmPaymentChange() {
    if (submitLock.current || !paymentConfirmation) return;
    submitLock.current = true;
    setConfirmPending(true);
    try {
      await onSubmit({ ...paymentConfirmation, confirmPaymentReset: true });
      setPaymentConfirmation(null);
    } catch {
      // Retain the confirmation and the page-owned error so it can be retried.
    } finally { submitLock.current = false; setConfirmPending(false); }
  }

  return (
    <form aria-busy={pending} aria-label={editing ? 'Editar compra' : 'Añadir compra'} className="min-w-0 max-w-full space-y-7" noValidate onSubmit={submit} ref={formRef}>
      {paymentConfirmation ? <PurchaseConfirmation title="¿Modificar el pago registrado?" description="Esta modificación sustituirá o retirará el registro del pago al contado o de la entrada. Confirma solo si los nuevos datos reflejan lo que ocurrió. El cambio quedará en el historial de auditoría; no modifica tus saldos." confirmLabel="Confirmar cambio de pago" error={error} isPending={pending} onCancel={() => { setPaymentConfirmation(null); formRef.current?.querySelector('button[type="submit"]')?.focus(); }} onConfirm={confirmPaymentChange} /> : null}
      <fieldset className="min-w-0 space-y-5" disabled={pending}>
        <legend className="mb-4 text-lg font-extrabold text-text">Compra</legend>
        {singleProduct && !editing ? <FormField disabled={pending} error={errors.items?.[0]?.name?.message} label="Nombre del producto" maxLength={200} {...register('items.0.name')} /> : null}
        {singleProduct && !editing ? <FormField disabled={pending} error={errors.items?.[0]?.quantity?.message} help={intakeHints.quantity ?? 'Número de unidades del producto, no el importe.'} inputMode="numeric" label="Cantidad" {...register('items.0.quantity')} /> : null}
        <div className="date-fields-grid grid min-w-0 gap-5">
          <FormField disabled={pending} error={errors.purchaseDate?.message} help={intakeHints.date} label="Fecha de compra" type="date" {...register('purchaseDate')} />
          <FormField disabled={pending} error={errors.total?.message} help={singleProduct ? 'Precio final de este producto, sin intereses de financiación.' : 'Precio de los productos, sin añadir los intereses de financiación.'} inputMode="decimal" label={`Total de la compra (${currency === 'EUR' ? '€' : currency})`} readOnly={paidHistory} {...register('total')} />
        </div>
        {editing ? <p className="text-xs leading-5 text-text-muted">Si cambias la fecha de compra, se recalculan las garantías por duración. Las fechas fin introducidas manualmente se conservan.</p> : null}
        <FormField disabled={pending} error={errors.merchant?.message} label="Tienda (opcional)" maxLength={200} {...register('merchant')} />
        <TextareaField disabled={pending} error={errors.notes?.message} label="Notas de la compra (opcional)" maxLength={2000} {...register('notes')} />
      </fieldset>

      <PurchasePaymentFields currency={currency} disabled={pending} errors={errors} initialPurchase={initialPurchase} register={register} timezone={timezone} watch={watch} />

      <fieldset className="min-w-0 space-y-4" disabled={pending}>
        <legend className="mb-2 text-lg font-extrabold text-text">¿De quién es?</legend>
        <div className="grid min-w-0 gap-2 sm:grid-cols-3">
          {[
            ['HOUSEHOLD', 'Del hogar'], ['PERSONAL', 'Personal'], ['SPLIT', 'Repartida'],
          ].map(([value, label]) => (
            <label className="flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-border-strong px-3 py-2.5 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft" key={value}>
              <input className="size-4 shrink-0 accent-brand" type="radio" value={value} {...register('ownershipType')} />{label}
            </label>
          ))}
        </div>
        <p aria-live="polite" className="text-sm leading-6 text-text-muted">
          {ownership === 'HOUSEHOLD'
            ? 'Visible para los miembros del hogar.'
            : ownership === 'PERSONAL'
              ? 'Solo podrá verla la persona propietaria. Si la asignas a otra persona, dejarás de verla.'
              : 'Solo podrán verla las personas del reparto. Si no participas, dejarás de verla.'}
        </p>
        {ownership === 'PERSONAL' ? (
          <SelectField disabled={pending} error={errors.personalPersonId?.message} label="Persona propietaria" {...register('personalPersonId')}>
            <option value="">Selecciona una persona</option>
            {ownershipPeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </SelectField>
        ) : null}
        {ownership === 'SPLIT' ? (
          <div className="min-w-0 space-y-4">
            <p className="text-sm leading-6 text-text-muted">Elige al menos dos personas y reparte exactamente el 100 %.</p>
            {shares.fields.map((share, index) => (
              <fieldset aria-describedby={`${id}-split-total`} className="min-w-0 space-y-3 rounded-xl border border-border p-3" key={share.id}>
                <legend className="px-1 text-sm font-bold text-text">Participante {index + 1}</legend>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <SelectField disabled={pending} error={errors.shares?.[index]?.householdPersonId?.message} label={`Persona ${index + 1}`} {...register(`shares.${index}.householdPersonId`)}>
                    <option value="">Selecciona una persona</option>
                    {ownershipPeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </SelectField>
                  <FormField disabled={pending} error={errors.shares?.[index]?.percentage?.message} inputMode="decimal" label={`Porcentaje de la persona ${index + 1} (%)`} {...register(`shares.${index}.percentage`)} />
                </div>
                {shares.fields.length > 2 ? <button aria-label={`Quitar participante ${index + 1}`} className={secondaryButton} disabled={pending} onClick={() => removeShare(index)} type="button">Quitar participante</button> : null}
              </fieldset>
            ))}
            <div aria-live="polite" className="rounded-xl bg-surface-muted p-3 text-sm" id={`${id}-split-total`}>
              <p className="font-bold text-text">Total: {total === null ? '—' : percentage(total)} %</p>
              <p className="mt-1 text-text-muted">{total === null ? 'Completa los porcentajes para comprobar el reparto.' : total < 10_000 ? `Falta ${percentage(10_000 - total)} % para completar el reparto.` : total > 10_000 ? `Sobra ${percentage(total - 10_000)} %. Reduce los porcentajes.` : 'El reparto suma el 100 %.'}</p>
              {splitInvalid ? <p className="mt-1 text-text-muted">Para guardar, elige personas distintas, con porcentajes mayores que cero y un total de 100 %.</p> : null}
            </div>
            {errors.shares?.root?.message ? <p className="text-sm font-medium text-red-700" role="alert">{errors.shares.root.message}</p> : null}
            <button className={secondaryButton} disabled={pending || shares.fields.length >= ownershipPeople.length} onClick={() => shares.append({ householdPersonId: '', percentage: '' }, { focusName: `shares.${shares.fields.length}.householdPersonId` })} type="button"><Plus aria-hidden="true" className="size-4 shrink-0" />Añadir persona al reparto</button>
            {ownershipPeople.length < 2 ? <p className="text-sm text-text-muted">Necesitas al menos dos personas en el hogar para repartir una compra.</p> : null}
          </div>
        ) : null}
      </fieldset>

      {!editing ? (
        <section aria-labelledby={`${id}-products`} className="min-w-0 space-y-4">
          <h3 className="text-lg font-extrabold text-text" id={`${id}-products`}>{singleProduct ? 'Garantía y detalles del producto' : 'Productos'}</h3>
          {items.fields.map((item, index) => (
            <fieldset className="min-w-0 rounded-2xl border border-border p-3 sm:p-5" disabled={pending} key={item.id}>
              {!singleProduct ? <legend className="px-1 text-sm font-extrabold text-text">Producto {index + 1}</legend> : null}
              <PurchaseItemFields warrantyHelp={singleProduct ? intakeHints.warranty : undefined} setValue={setValue} singleProduct={singleProduct} currency={currency} disabled={pending} errors={errors.items?.[index]} prefix={`items.${index}`} purchaseDate={purchaseDate} register={register} watch={watch} />
              {!singleProduct ? <div className="mt-4">
                <button aria-label={`Quitar producto ${index + 1}`} className={secondaryButton} disabled={pending || items.fields.length === 1} onClick={() => removeProduct(index)} type="button"><Trash2 aria-hidden="true" className="size-4 shrink-0" />Quitar producto</button>
                {items.fields.length === 1 ? <p className="mt-2 text-xs text-text-muted">La compra debe conservar al menos un producto.</p> : null}
              </div> : null}
            </fieldset>
          ))}
          {!singleProduct ? <button className={`${secondaryButton} w-full`} disabled={pending || items.fields.length >= MAX_PURCHASE_ITEMS} onClick={() => items.append(purchaseItemDefaults(), { focusName: `items.${items.fields.length}.name` })} type="button"><Plus aria-hidden="true" className="size-4 shrink-0" />Añadir otro producto</button> : null}
          {items.fields.length >= MAX_PURCHASE_ITEMS ? <p className="text-xs text-text-muted">Has alcanzado el máximo de 50 productos por compra.</p> : null}
        </section>
      ) : null}

      <p className="text-sm leading-6 text-text-muted">El pago único aparecerá en Gastos puntuales; la financiación, en Gastos recurrentes hasta la última cuota, y su entrada en Puntuales. Siempre con margen 0 %, sin duplicar importes. Solo los pagos confirmados suman gasto utilizado; los saldos de tus cuentas no se modifican automáticamente.</p>
      <div className="space-y-3">
        <AuthError error={paymentConfirmation ? null : error} />
        <SubmitButton disabled={splitInvalid} isPending={pending} pendingLabel="Guardando compra…">{editing ? 'Guardar cambios de la compra' : 'Guardar compra'}</SubmitButton>
        <button className={`${secondaryButton} w-full`} disabled={pending} onClick={onCancel} type="button">Cancelar</button>
      </div>
    </form>
  );
}
