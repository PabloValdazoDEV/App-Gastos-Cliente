import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import { queryKeys } from '../api/queryKeys';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { CategoryManager } from '../features/households/CategoryManager';
import { householdService } from '../features/households/householdService';
import { useHousehold } from '../features/households/useHousehold';

export function SettingsPage() {
  const { currentHousehold } = useHousehold();
  const householdId = currentHousehold?.id;
  const householdSafetyMarginBps = currentHousehold?.safetyMarginBps;
  const [margin, setMargin] = useState(
    currentHousehold ? String(currentHousehold.safetyMarginBps / 100) : '10',
  );
  const canManage = ['ADMIN', 'OWNER'].includes(currentHousehold?.access?.role);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: householdService.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.households.all() });
      queryClient.invalidateQueries({ queryKey: ['budget', currentHousehold.id] });
      toast.success('Margen de seguridad actualizado.');
    },
  });

  useEffect(() => {
    if (Number.isInteger(householdSafetyMarginBps)) {
      setMargin(String(householdSafetyMarginBps / 100));
    }
  }, [householdId, householdSafetyMarginBps]);

  if (!currentHousehold) {
    return <EmptyState action={<Link className="font-bold text-brand-strong" to="/hogar">Crear hogar</Link>} description="Las preferencias financieras pertenecen a un hogar." icon={Settings} title="No hay hogar seleccionado" />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Preferencias" />
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7" aria-labelledby="security-margin">
        <h2 className="text-lg font-bold" id="security-margin">Margen de seguridad general</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">Se añade a la previsión mensual. Una categoría o un gasto recurrente pueden sobrescribirlo.</p>
        {canManage ? (
          <form
            className="mt-5 flex max-w-sm flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const numeric = Number(String(margin).replace(',', '.'));
              if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
                toast.error('El margen debe estar entre 0 y 100 %.');
                return;
              }
              mutation.mutate({
                householdId: currentHousehold.id,
                body: { safetyMarginBps: Math.round(numeric * 100) },
              });
            }}
          >
            <label className="text-sm font-bold" htmlFor="general-margin">Porcentaje de margen</label>
            <div className="flex items-center gap-2">
              <input className="min-h-12 min-w-0 flex-1 rounded-xl border border-border-strong px-3" id="general-margin" inputMode="decimal" max="100" min="0" onChange={(event) => setMargin(event.target.value)} required step="0.01" type="text" value={margin} />
              <span aria-hidden="true" className="font-bold">%</span>
            </div>
            <button className="min-h-12 rounded-xl bg-brand px-5 font-bold text-on-brand disabled:opacity-60" disabled={mutation.isPending} type="submit">{mutation.isPending ? 'Guardando…' : 'Guardar margen'}</button>
            {mutation.isError ? <p className="text-sm text-red-700" role="alert">{mutation.error.message}</p> : null}
          </form>
        ) : (
          <p className="mt-5 rounded-xl bg-surface-muted p-4 text-sm leading-6 text-text-muted">
            Margen actual: <strong className="text-text">{currentHousehold.safetyMarginBps / 100} %</strong>. Solo administradores y propietarios pueden cambiarlo.
          </p>
        )}
      </section>
      <CategoryManager household={currentHousehold} />
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-bold">Cuenta</h2>
        <Link className="mt-3 inline-flex min-h-11 items-center font-bold text-brand-strong" to="/mas/sesiones">Gestionar sesiones activas</Link>
      </section>
    </div>
  );
}
