import { useState } from 'react';
import { addWarrantyMonths } from './purchaseFormState';

// The country, type of seller, consumer purchase and delivery date are facts
// the receipt/model cannot reliably infer. Apply the legal preset only after
// explicit confirmation; never classify warranty by product name or brand.
export function PurchaseWarrantySuggestion({ purchaseDate, disabled, warrantyEnabled, onApply }) {
  const [confirmedDate, setConfirmedDate] = useState(null);
  const eligibleDate = purchaseDate >= '2022-01-01' && Boolean(addWarrantyMonths(purchaseDate, 36));
  const confirmed = Boolean(purchaseDate && confirmedDate === purchaseDate);
  return <details className="min-w-0 rounded-xl border border-border bg-surface-muted p-3">
    <summary className="min-h-11 cursor-pointer content-center rounded-lg text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Sugerir garantía legal según la compra</summary>
    <div className="mt-3 space-y-3 text-sm leading-6">
      <p>En España, los bienes nuevos comprados por consumidores a un profesional desde el 1 de enero de 2022 tienen un plazo legal de 3 años desde la entrega. Incluye tecnología y electrodomésticos; no depende de la marca.</p>
      <p className="text-text-muted">No es la garantía comercial del fabricante. Segunda mano, compras a particulares, servicios, contenido digital y otros países requieren revisar sus condiciones. Si la entrega fue posterior a la compra, indica la fecha fin manualmente.</p>
      <a className="inline-flex min-h-11 items-center rounded-lg font-semibold text-brand-strong underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555#a120" rel="noreferrer" target="_blank">Consultar la garantía legal en el BOE</a>
      {eligibleDate ? <>
        <label className="flex min-h-11 items-start gap-3 rounded-xl border border-border-strong bg-surface p-3">
          <input checked={confirmed} className="mt-1 size-4 shrink-0 accent-brand" disabled={disabled} onChange={(event) => setConfirmedDate(event.target.checked ? purchaseDate : null)} type="checkbox" />
          <span>Confirmo que es un bien nuevo comprado como consumidor a un profesional en España y entregado en la fecha de compra.</span>
        </label>
        <button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong px-4 py-2.5 font-bold hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60" disabled={disabled || !confirmed} onClick={onApply} type="button">{warrantyEnabled ? 'Sustituir por garantía legal de 3 años' : 'Aplicar garantía legal de 3 años'}</button>
        {warrantyEnabled ? <p className="text-xs text-text-muted">Sustituye únicamente el plazo registrado en esta ficha, no los derechos que tengas. Conserva el documento de la garantía comercial.</p> : null}
      </> : <p className="text-text-muted">Para esta sugerencia, indica una fecha de compra válida desde el 1 de enero de 2022. Para otras compras, registra el plazo que corresponda al documento y sus condiciones.</p>}
    </div>
  </details>;
}
