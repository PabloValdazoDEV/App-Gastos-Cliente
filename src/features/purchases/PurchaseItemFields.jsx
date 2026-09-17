import { useId } from 'react';

import { SelectField, TextareaField } from '../../pages/expensePageShared';
import { FormField } from '../auth/components/FormField';
import { addWarrantyMonths, formatWarrantyPreview } from './purchaseFormState';

export function PurchaseItemFields({ register, watch, errors = {}, prefix = '', purchaseDate, disabled, currency = 'EUR' }) {
  const id = useId();
  const field = (name) => prefix ? `${prefix}.${name}` : name;
  const warrantyEnabled = watch(field('warrantyEnabled'));
  const method = watch(field('warrantyMethod'));
  const duration = watch(field('warrantyDuration'));
  const unit = watch(field('warrantyUnit'));
  const explicitDate = watch(field('warrantyEndsAt'));
  const preview = warrantyEnabled ? method === 'EXPLICIT_DATE' ? explicitDate : addWarrantyMonths(purchaseDate, Number(duration) * (unit === 'YEARS' ? 12 : 1)) : null;

  return (
    <div className="min-w-0 space-y-5">
      <FormField disabled={disabled} error={errors.name?.message} label="Nombre del producto" maxLength={200} {...register(field('name'))} />
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">
        <FormField disabled={disabled} error={errors.brand?.message} label="Marca (opcional)" maxLength={120} {...register(field('brand'))} />
        <FormField disabled={disabled} error={errors.model?.message} label="Modelo (opcional)" maxLength={120} {...register(field('model'))} />
      </div>
      <FormField disabled={disabled} error={errors.price?.message} help="No tiene que coincidir con el total de la compra." inputMode="decimal" label={`Precio del producto (${currency === 'EUR' ? '€' : currency}, opcional)`} {...register(field('price'))} />
      <fieldset className="min-w-0 space-y-3" disabled={disabled}>
        <legend className="text-sm font-bold text-text">Garantía</legend>
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border-strong px-3 py-2.5 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
          <input className="size-4 shrink-0 accent-brand" type="checkbox" {...register(field('warrantyEnabled'))} />
          Tiene garantía
        </label>
        {!warrantyEnabled ? <p className="text-xs leading-5 text-text-muted">Sin garantía registrada.</p> : (
          <div className="min-w-0 space-y-4">
            <fieldset className="min-w-0">
              <legend className="text-sm font-bold text-text">¿Cómo quieres indicar la garantía?</legend>
              <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
                {[
                  ['DURATION', 'Duración'], ['EXPLICIT_DATE', 'Fecha fin'],
                ].map(([value, label]) => (
                  <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-border-strong px-3 py-2.5 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft" key={value}>
                    <input className="size-4 shrink-0 accent-brand" type="radio" value={value} {...register(field('warrantyMethod'))} />{label}
                  </label>
                ))}
              </div>
            </fieldset>
            {method === 'DURATION' ? (
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <FormField disabled={disabled} error={errors.warrantyDuration?.message} inputMode="numeric" label="Duración de la garantía" {...register(field('warrantyDuration'))} />
                <SelectField disabled={disabled} label="Unidad de duración" {...register(field('warrantyUnit'))}>
                  <option value="MONTHS">Meses</option><option value="YEARS">Años</option>
                </SelectField>
              </div>
            ) : <FormField disabled={disabled} error={errors.warrantyEndsAt?.message} label="Fecha fin de garantía" type="date" {...register(field('warrantyEndsAt'))} />}
            <p aria-live="polite" className="break-words text-sm font-semibold text-brand-deep" id={`${id}-preview`}>
              {preview && /^\d{4}-\d{2}-\d{2}$/.test(preview) ? `Hasta el ${formatWarrantyPreview(preview)}` : 'Indica los datos para calcular la fecha fin.'}
            </p>
            <p className="text-xs leading-5 text-text-muted">Registra la garantía que conoces; no se asigna ninguna duración automáticamente.</p>
          </div>
        )}
      </fieldset>
      <details className="min-w-0 rounded-xl border border-border p-3">
        <summary className="min-h-11 cursor-pointer content-center rounded-lg text-sm font-bold text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Más datos: cantidad, serie, IMEI y notas</summary>
        <div className="mt-4 min-w-0 space-y-5">
          <FormField disabled={disabled} error={errors.quantity?.message} inputMode="numeric" label="Cantidad" {...register(field('quantity'))} />
          <FormField disabled={disabled} error={errors.serialNumber?.message} label="Número de serie (opcional)" maxLength={100} {...register(field('serialNumber'))} />
          <FormField disabled={disabled} error={errors.imei?.message} inputMode="text" label="IMEI (opcional)" maxLength={100} {...register(field('imei'))} />
          <TextareaField disabled={disabled} error={errors.notes?.message} label="Notas del producto (opcional)" maxLength={2000} {...register(field('notes'))} />
        </div>
      </details>
    </div>
  );
}
