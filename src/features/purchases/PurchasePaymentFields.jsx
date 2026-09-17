import { useId } from 'react';

import { FormField } from '../auth/components/FormField';
import { formatCents } from '../finance/money';
import { purchasePaymentToday } from './purchaseInstallmentFormState';
import { financingPreview, hasRecordedFinancingPayments, MAX_PURCHASE_INSTALLMENTS, paymentAmountCents } from './purchasePaymentForm';

export function PurchasePaymentFields({ register, watch, errors, disabled, initialPurchase = null, currency = 'EUR', timezone }) {
  const id = useId();
  const method = watch('paymentMethod');
  const upfrontPaid = watch('upfrontPaid');
  const downPaymentPaid = watch('downPaymentPaid');
  const preview = financingPreview(watch());
  const locked = hasRecordedFinancingPayments(initialPurchase);
  const historicalUnconfirmed = Boolean(initialPurchase && initialPurchase.paymentMethod !== 'FINANCED' && !initialPurchase.paymentDate);
  const currencyLabel = currency === 'EUR' ? '€' : currency;
  const down = paymentAmountCents(watch('downPayment'));
  const today = purchasePaymentToday(timezone);
  return (
    <fieldset className="min-w-0 max-w-full space-y-5" disabled={disabled}>
      <legend className="mb-4 text-lg font-extrabold text-text">Forma de pago</legend>
      <div aria-describedby={locked ? `${id}-history` : undefined} className="grid min-w-0 gap-2 sm:grid-cols-2">
        {[['UPFRONT', 'Al contado'], ['FINANCED', 'Financiado']].map(([value, label]) => <label className={`flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-border-strong px-3 py-2.5 text-sm font-bold has-[:checked]:border-brand has-[:checked]:bg-brand-soft ${locked ? 'cursor-not-allowed text-text-muted' : 'cursor-pointer'}`} key={value}>
          <input className="size-5 shrink-0 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" disabled={disabled || locked} type="radio" value={value} {...register('paymentMethod')} />{label}
        </label>)}
      </div>
      {errors.paymentMethod ? <p className="text-sm font-medium text-red-700" role="alert">{errors.paymentMethod.message}</p> : null}
      {locked ? <p className="rounded-xl border border-border bg-surface-muted p-3 text-sm leading-6 text-text-muted" id={`${id}-history`}>Ya existen cuotas registradas como pagadas. Para conservar su historial, no se pueden cambiar el precio, la forma de pago ni la estructura de la financiación. Puedes editar la entidad y los datos del pago de la entrada.</p> : null}
      {method === 'UPFRONT' ? <div className="min-w-0 space-y-4">
        {historicalUnconfirmed ? <>
          <p className="text-sm leading-6 text-text-muted">Esta compra anterior no tiene un pago confirmado. Editar sus otros datos no registra ningún pago.</p>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-border-strong p-3 text-sm font-semibold">
            <input className="size-5 shrink-0 accent-brand" type="checkbox" {...register('upfrontPaid')} />Confirmo que la compra está pagada
          </label>
        </> : null}
        {upfrontPaid ? <>
          <div className="date-fields-grid grid min-w-0 gap-5">
            <FormField disabled={disabled} error={errors.paymentDate?.message} label="Fecha de pago" max={today} type="date" {...register('paymentDate')} />
            <FormField disabled={disabled} error={errors.paidAmount?.message} inputMode="decimal" label={`Importe pagado (${currencyLabel})`} {...register('paidAmount')} />
          </div>
          <p className="text-sm leading-6 text-text-muted">Al guardar, este importe y esta fecha quedarán registrados como un pago realizado. No se descontará dinero de tus cuentas.</p>
        </> : null}
      </div> : <div className="min-w-0 space-y-5">
        <div className="date-fields-grid grid min-w-0 gap-5">
          <FormField disabled={disabled} error={errors.downPayment?.message} inputMode="decimal" label={`Entrada (${currencyLabel})`} readOnly={locked} {...register('downPayment')} />
          <FormField disabled={disabled} error={errors.financingProvider?.message} label="Entidad o tienda financiera (opcional)" maxLength={200} {...register('financingProvider')} />
          <FormField disabled={disabled} error={errors.installmentCount?.message} inputMode="numeric" label="Número de cuotas" max={MAX_PURCHASE_INSTALLMENTS} min={1} readOnly={locked} step={1} type="number" {...register('installmentCount')} />
          <FormField disabled={disabled} error={errors.installmentAmount?.message} inputMode="decimal" label={`Importe habitual de cuota (${currencyLabel})`} readOnly={locked} {...register('installmentAmount')} />
          <FormField disabled={disabled} error={errors.firstInstallmentDate?.message} help="Una cuota al mes, con meses naturales. Los fines de mes se ajustan al último día disponible." label="Primera cuota" readOnly={locked} type="date" {...register('firstInstallmentDate')} />
          <FormField disabled={disabled} error={errors.financingTotal?.message} help="Incluye intereses o comisiones si los hay. La última cuota se ajustará para sumar exactamente este total." inputMode="decimal" label={`Total a pagar en cuotas (${currencyLabel})`} readOnly={locked} {...register('financingTotal')} />
        </div>
        {down > 0 ? <div className="min-w-0 space-y-4">
          <label className="flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-border-strong p-3 text-sm font-semibold">
            <input className="size-5 shrink-0 accent-brand" type="checkbox" {...register('downPaymentPaid')} />La entrada ya está pagada
          </label>
          {downPaymentPaid ? <div className="date-fields-grid grid min-w-0 gap-5"><FormField disabled={disabled} error={errors.downPaymentPaidAt?.message} label="Fecha de pago de la entrada" max={today} type="date" {...register('downPaymentPaidAt')} /></div> : <p className="text-sm leading-6 text-text-muted">La entrada quedará pendiente hasta que confirmes que está pagada. No se cuenta como una cuota.</p>}
        </div> : null}
        <section aria-labelledby={`${id}-summary`} className="min-w-0 space-y-3 rounded-xl bg-surface-muted p-4">
          <h3 className="font-extrabold" id={`${id}-summary`}>Resumen de financiación</h3>
          <dl aria-live="polite" className="grid min-w-0 gap-3 sm:grid-cols-2">
            {[
              ['Precio de compra', preview.priceCents], ['Entrada', preview.downPaymentCents],
              ['Principal financiado', preview.financedPrincipalCents], ['Total de cuotas', preview.financingTotalCents],
              ['Coste de financiación', preview.financingCostCents], ['Coste total final', preview.totalCostCents],
            ].map(([label, cents]) => <div className="min-w-0" key={label}><dt className="text-sm text-text-muted">{label}</dt><dd className="min-w-0 break-words font-extrabold tabular-nums [overflow-wrap:anywhere]">{formatCents(cents, currency)}</dd></div>)}
          </dl>
          {preview.lastInstallmentCents > 0 && preview.lastInstallmentCents !== preview.installmentAmountCents ? <p aria-live="polite" className="border-t border-border pt-3 text-sm leading-6">Última cuota ajustada: <strong className="tabular-nums">{formatCents(preview.lastInstallmentCents, currency)}</strong>. Así no se pierde ningún céntimo.</p> : null}
          <p className="text-xs leading-5 text-text-muted">El coste total final es la entrada más las cuotas. El coste de financiación es la diferencia respecto al precio de compra.</p>
        </section>
      </div>}
    </fieldset>
  );
}
