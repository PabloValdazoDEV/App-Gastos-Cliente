import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetMarginControl } from './BudgetMarginControl';

const mocks = vi.hoisted(() => ({ save: vi.fn(), statistics: vi.fn() }));
vi.mock('./financeService', () => ({ financeService: { setBudgetMarginPreference: mocks.save } }));

const group = { categoryId: 'category', category: { name: 'Electricidad con un nombre largo' }, scope: 'HOUSEHOLD' };
const data = (enabled = false) => ({
  ...group, applySafetyMargin: enabled, effectiveMarginBps: enabled ? 1_500 : 0,
  availableMarginBps: 1_500, availableMarginSource: 'CATEGORY', recommendedCents: enabled ? 11_500 : 10_000,
});
function Harness({ expenseType }) {
  const query = useQuery({ queryKey: [expenseType === 'INVOICE' ? 'invoiceStatistics' : 'variableStatistics', 'home'], queryFn: mocks.statistics });
  return <><BudgetMarginControl expenseType={expenseType} group={group} householdId="home" preference={query.data?.[0]} isLoading={query.isPending} error={query.error} onRetry={query.refetch} /><output aria-label="Recomendado">{query.data?.[0].recommendedCents}</output></>;
}
function renderControl(expenseType = 'INVOICE') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const spy = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}><Harness expenseType={expenseType} /></QueryClientProvider>);
  return { client, spy };
}

describe('BudgetMarginControl compartido', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.statistics.mockResolvedValue([data()]);
    mocks.save.mockImplementation(async ({ body }) => {
      const result = data(body.applySafetyMargin);
      mocks.statistics.mockResolvedValue([result]);
      return result;
    });
  });

  it.each(['INVOICE', 'VARIABLE'])('%s: apagado por defecto, teclado activa/desactiva y refresca recomendado y caches', async (expenseType) => {
    const user = userEvent.setup();
    const { spy } = renderControl(expenseType);
    await screen.findByText('Sin margen');
    const control = screen.getByRole('checkbox', { name: /Aplicar margen al presupuesto recomendado · Electricidad/ });
    expect(control).not.toBeChecked();
    expect(control).toHaveAccessibleDescription(expenseType === 'INVOICE'
      ? 'El margen solo afecta a la cantidad recomendada del presupuesto. No modifica las facturas guardadas.'
      : 'El margen solo afecta al presupuesto recomendado. No modifica el total registrado del mes ni las medias históricas.');
    await user.tab();
    expect(control).toHaveFocus();
    await user.keyboard(' ');
    await waitFor(() => expect(control).toBeChecked());
    expect(screen.getByText(/Margen activado · 15 % de Electricidad/)).toBeInTheDocument();
    expect(screen.getByLabelText('Recomendado')).toHaveTextContent('11500');
    expect(mocks.save).toHaveBeenCalledWith({ householdId: 'home', body: { categoryId: 'category', expenseType, scope: 'HOUSEHOLD', personalPersonId: null, applySafetyMargin: true } });
    for (const prefix of ['budget', 'dashboard', 'simulation', 'plannings', 'monthlyPlanning', 'invoiceStatistics', 'variableStatistics', 'budgetMarginPreferences']) {
      expect(spy).toHaveBeenCalledWith({ queryKey: [prefix, 'home'] });
    }
    await user.click(control);
    await waitFor(() => expect(control).not.toBeChecked());
    expect(screen.getByLabelText('Recomendado')).toHaveTextContent('10000');
    expect(screen.getByText('Preferencia guardada.')).toBeInTheDocument();
    expect(mocks.statistics).toHaveBeenCalledTimes(3);
  });

  it('desactiva el control durante carga y permite recuperar un error de consulta', async () => {
    const user = userEvent.setup();
    let rejectRequest;
    mocks.statistics.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject; }));
    renderControl();
    expect(screen.getByText('Cargando margen…')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    await act(async () => rejectRequest(new Error('No se pudo consultar el margen.')));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar el margen.');
    expect(screen.getByRole('checkbox')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reintentar cargar margen' }));
    await screen.findByText('Sin margen');
    expect(screen.getByRole('checkbox')).toBeEnabled();
  });

  it('bloquea doble envío, conserva estado ante error y permite reintentar', async () => {
    const user = userEvent.setup();
    let rejectSave;
    mocks.save.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject; }));
    renderControl();
    await screen.findByText('Sin margen');
    const control = screen.getByRole('checkbox');
    await user.click(control);
    expect(await screen.findByText('Guardando margen…')).toBeInTheDocument();
    expect(control).toBeDisabled();
    await user.click(control);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    await act(async () => rejectSave(new Error('No tienes permiso para cambiar este grupo.')));
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso');
    expect(control).not.toBeChecked();
    await user.click(control);
    await waitFor(() => expect(control).toBeChecked());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muestra margen general sin calcular el porcentaje en el cliente', async () => {
    mocks.statistics.mockResolvedValue([{ ...data(true), availableMarginSource: 'HOUSEHOLD', availableMarginBps: 700, effectiveMarginBps: 700 }]);
    renderControl();
    expect(await screen.findByText('Margen activado · 7 % general')).toBeInTheDocument();
  });
});
