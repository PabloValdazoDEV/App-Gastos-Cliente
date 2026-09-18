import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ oneTimeExpenses: vi.fn(), createOneTimeExpense: vi.fn(), updateOneTimeExpense: vi.fn(), deleteOneTimeExpense: vi.fn(), listCategories: vi.fn(), listPeople: vi.fn() }));
vi.mock('../features/finance/financeService', () => ({ financeService: { oneTimeExpenses: mocks.oneTimeExpenses, createOneTimeExpense: mocks.createOneTimeExpense, updateOneTimeExpense: mocks.updateOneTimeExpense, deleteOneTimeExpense: mocks.deleteOneTimeExpense } }));
vi.mock('../features/households/householdService', () => ({ householdService: { listCategories: mocks.listCategories, listPeople: mocks.listPeople } }));
vi.mock('../features/households/useHousehold', () => ({
  useHousehold: () => ({ currentHousehold: { id: 'home', currency: 'EUR' }, isPending: false, isError: false }),
}));

import { OneTimeExpensesPage } from './OneTimeExpensesPage';

vi.mock('../features/purchases/purchasesService', () => ({ purchasesService: { list: vi.fn(async () => []) } }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const result = render(<QueryClientProvider client={client}><OneTimeExpensesPage /></QueryClientProvider>);
  return { ...result, client, invalidate };
}

describe('OneTimeExpensesPage: filtros compartidos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCategories.mockResolvedValue({ categories: [{ id: 'home', name: 'Hogar' }, { id: 'health', name: 'Salud' }] });
    mocks.listPeople.mockResolvedValue({ people: [] });
    mocks.createOneTimeExpense.mockResolvedValue({ id: 'new' });
    mocks.updateOneTimeExpense.mockResolvedValue({ id: 'repair' });
    mocks.deleteOneTimeExpense.mockResolvedValue({ deleted: true });
    mocks.oneTimeExpenses.mockResolvedValue([
      { id: 'repair', name: 'Reparar ventana', categoryId: 'home', category: { name: 'Hogar' }, scope: 'HOUSEHOLD', amountCents: 7_000, expenseDate: '2026-09-15' },
      { id: 'glasses', name: 'Gafas de repuesto', categoryId: 'health', category: { name: 'Salud' }, scope: 'PERSONAL', personalPerson: { name: 'Ana' }, notes: 'Óptica', amountCents: 5_000, expenseDate: '2026-09-16' },
    ]);
  });

  it('muestra un único buscador con panel cerrado y filtra por ámbito y categoría', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('searchbox', { name: 'Buscar gastos puntuales' })).toBeVisible();
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Filtros' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ámbito' }), 'PERSONAL');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Categoría' }), 'health');
    expect(screen.getByRole('heading', { name: 'Gafas de repuesto' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reparar ventana' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filtros 2 activos' }));
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByRole('heading', { name: 'Reparar ventana' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gafas de repuesto' })).toBeInTheDocument();
    expect(mocks.oneTimeExpenses).toHaveBeenCalledTimes(1);
  });

  it('busca por nota y ofrece recuperar los resultados tras una búsqueda vacía', async () => {
    const user = userEvent.setup();
    renderPage();
    const search = await screen.findByRole('searchbox');
    await user.type(search, 'óptica');
    expect(screen.getByRole('heading', { name: 'Gafas de repuesto' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reparar ventana' })).not.toBeInTheDocument();
    await user.type(search, ' sin resultados');
    expect(screen.getByText('No hay gastos que coincidan con la búsqueda.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(search).toHaveValue('');
    expect(screen.getByRole('heading', { name: 'Reparar ventana' })).toBeInTheDocument();
  });

  it.each([false, true])('nuevo puntual empieza desmarcado y guarda activación %s', async (enabled) => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();
    await screen.findByRole('heading', { name: 'Reparar ventana' });
    await user.click(screen.getByRole('button', { name: 'Añadir gasto puntual' }));
    const control = screen.getByRole('checkbox', { name: 'Aplicar margen de seguridad a este gasto' });
    expect(control).not.toBeChecked();
    expect(control).toHaveAccessibleDescription(/margen de su categoría/);
    if (enabled) await user.click(control);
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Compra excepcional');
    await user.type(screen.getByLabelText('Importe (€)'), '50');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto' }));
    await waitFor(() => expect(mocks.createOneTimeExpense).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ applySafetyMargin: enabled, amountCents: 5000 }) })));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'home'] }));
  });

  it('editar conserva el margen guardado y permite apagarlo', async () => {
    const user = userEvent.setup();
    mocks.oneTimeExpenses.mockResolvedValue([{ id: 'repair', name: 'Reparar ventana', categoryId: 'home', category: { name: 'Hogar' }, scope: 'HOUSEHOLD', amountCents: 7000, expenseDate: '2026-09-15', applySafetyMargin: true }]);
    const { invalidate } = renderPage();
    const heading = await screen.findByRole('heading', { name: 'Reparar ventana' });
    await user.click(within(heading.closest('li')).getByRole('button', { name: /Editar/ }));
    const control = screen.getByRole('checkbox', { name: 'Aplicar margen de seguridad a este gasto' });
    expect(control).toBeChecked();
    await user.click(control);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(mocks.updateOneTimeExpense).toHaveBeenCalledWith(expect.objectContaining({ expenseId: 'repair', body: expect.objectContaining({ applySafetyMargin: false }) })));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'home'] }));
  });

  it('eliminar un puntual refresca presupuesto, Dashboard y planificación sin registrar un pago', async () => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();
    const heading = await screen.findByRole('heading', { name: 'Reparar ventana' });
    await user.click(within(heading.closest('li')).getByRole('button', { name: /Eliminar/ }));
    expect(mocks.deleteOneTimeExpense).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar gasto' }));
    await waitFor(() => expect(mocks.deleteOneTimeExpense).toHaveBeenCalledWith({ householdId: 'home', expenseId: 'repair' }));
    for (const prefix of ['dashboard', 'budget', 'simulation', 'plannings', 'monthlyPlanning']) {
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: [prefix, 'home'] }));
    }
  });
});
