import { useState } from 'react';
import { developmentDateEnabled, getDevelopmentDate, saveDevelopmentDate } from './developmentDate';

export function DevelopmentDateControl({ reload = () => window.location.reload() }) {
  const [activeDate] = useState(getDevelopmentDate);
  const [date, setDate] = useState(activeDate ?? '');
  const [error, setError] = useState('');
  if (!developmentDateEnabled()) return null;

  function apply(value) {
    try {
      saveDevelopmentDate(value);
      // A new page also discards cached calculations and date-dependent forms.
      reload();
    } catch (cause) { setError(cause.message); }
  }

  return (
    <section aria-label="Fecha de desarrollo" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <p className="text-sm font-bold">Desarrollo · {activeDate ? `Fecha simulada: ${activeDate.split('-').reverse().join('/')}` : 'Fecha real'}</p>
      <form className="mt-3 flex min-w-0 flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); apply(date); }}>
        <div className="min-w-0 max-w-full">
          <label className="block text-sm font-semibold" htmlFor="development-date">Simular hoy</label>
          <input className="mt-1 min-h-11 min-w-0 max-w-full rounded-xl border border-amber-400 bg-surface px-3" id="development-date" type="date" min="0100-01-01" max="9999-12-31" required value={date} onChange={(event) => { setDate(event.target.value); setError(''); }} />
        </div>
        <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" type="submit">Aplicar fecha</button>
        {activeDate ? <button className="min-h-11 rounded-xl border border-amber-400 px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" type="button" onClick={() => apply(null)}>Volver a fecha real</button> : null}
      </form>
      <p className="mt-2 text-xs leading-5">Cambia la fecha de los cálculos, el calendario y los formularios en esta pestaña. Al aplicarla se recarga la página; guarda antes cualquier formulario abierto. Los cambios que guardes se realizan en la base de desarrollo.</p>
      {error ? <p className="mt-2 text-sm font-semibold" role="alert">{error}</p> : null}
    </section>
  );
}
