import { Filter, Search } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { SelectField } from '../../pages/expensePageShared';

export function PurchaseFilters({ search, ownership, warranty, onSearchChange, onOwnershipChange, onWarrantyChange }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const searchId = useId();
  const toggleRef = useRef(null);
  const searchRef = useRef(null);
  const count = Number(ownership !== 'ALL') + Number(warranty !== 'ALL');
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-3 shadow-card sm:p-4">
      <label className="mb-1.5 block text-sm font-bold text-text" htmlFor={searchId}>Buscar compras</label>
      <div className="flex items-end gap-2">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-4 size-4 text-text-soft" />
          <input className="min-h-12 w-full min-w-0 rounded-xl border border-border-strong bg-surface pl-10 pr-3 text-base outline-none focus:border-focus focus:ring-2 focus:ring-focus/20" id={searchId} onChange={(event) => onSearchChange(event.target.value)} placeholder="Producto, marca, modelo o tienda" ref={searchRef} type="search" value={search} />
        </div>
        <button aria-controls={panelId} aria-expanded={expanded} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-border-strong px-3 py-2 text-sm font-bold hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => setExpanded(!expanded)} ref={toggleRef} type="button">
          <Filter aria-hidden="true" className="size-4" />Filtrar
          {count > 0 ? <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-xs text-brand-strong">{count}<span className="sr-only"> {count === 1 ? 'activo' : 'activos'}</span></span> : null}
        </button>
      </div>
      <div hidden={!expanded} id={panelId} onKeyDown={(event) => { if (event.key === 'Escape') { setExpanded(false); toggleRef.current?.focus(); } }}>
        <div className="mt-4 grid min-w-0 gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <SelectField label="Propiedad" onChange={(event) => onOwnershipChange(event.target.value)} value={ownership}>
            <option value="ALL">Todas</option><option value="HOUSEHOLD">Del hogar</option><option value="PERSONAL">Personal</option><option value="SPLIT">Repartida</option>
          </SelectField>
          <SelectField label="Garantía" onChange={(event) => onWarrantyChange(event.target.value)} value={warranty}>
            <option value="ALL">Todas</option><option value="ACTIVE">Vigente</option><option value="EXPIRING_SOON">Próxima a caducar</option><option value="EXPIRED">Caducada</option><option value="NONE">Sin garantía</option>
          </SelectField>
        </div>
        <p className="mt-3 text-xs leading-5 text-text-muted">La garantía filtra compras con al menos un producto en ese estado.</p>
      </div>
      {count > 0 || search ? <button className="mt-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold text-brand-strong underline underline-offset-4 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => { onSearchChange(''); onOwnershipChange('ALL'); onWarrantyChange('ALL'); searchRef.current?.focus(); }} type="button">Limpiar filtros</button> : null}
    </div>
  );
}
