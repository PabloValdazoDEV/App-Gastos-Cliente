import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
  // JSDOM does not implement the native dialog's top layer.
  const originalShowModal = HTMLDialogElement.prototype.showModal;
  const originalClose = HTMLDialogElement.prototype.close;
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  });
  afterAll(() => {
    HTMLDialogElement.prototype.showModal = originalShowModal;
    HTMLDialogElement.prototype.close = originalClose;
  });
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

  it('agrupa por año y mes del gasto y ordena fechas aunque la API venga desordenada', async () => {
    const expense = (id, date) => ({ id, name: id, categoryId: 'home', scope: 'HOUSEHOLD', amountCents: 1000, expenseDate: date });
    mocks.oneTimeExpenses.mockResolvedValue([
      expense('Anterior', '2025-12-31'),
      expense('Primero del mes', '2026-09-01T00:00:00.000Z'),
      expense('Enero', '2026-01-01'),
      expense('Más reciente', '2026-09-20'),
    ]);
    renderPage();
    const year = await screen.findByRole('region', { name: '2026' });
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['2026', '2025']);
    expect(within(year).getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).toEqual(['Septiembre', 'Enero']);
    const september = within(year).getByRole('region', { name: 'Septiembre' });
    expect(within(september).getAllByRole('heading', { level: 5 }).map((heading) => heading.textContent)).toEqual(['Más reciente', 'Primero del mes']);
    expect(within(screen.getByRole('region', { name: '2025' })).getByRole('heading', { name: 'Anterior' })).toBeVisible();
  });

  it.each([false, true])('nuevo puntual empieza desmarcado y guarda activación %s', async (enabled) => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();
    await screen.findByRole('heading', { name: 'Reparar ventana' });
    await user.click(screen.getByRole('button', { name: 'Añadir gasto puntual' }));
    expect(screen.getByRole('dialog', { name: 'Añadir gasto puntual' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveFocus();
    const control = screen.getByRole('checkbox', { name: 'Aplicar margen de seguridad a este gasto' });
    expect(control).not.toBeChecked();
    expect(control).toHaveAccessibleDescription(/margen de su categoría/);
    if (enabled) await user.click(control);
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Compra excepcional');
    await user.type(screen.getByLabelText('Importe (€)'), '50');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto' }));
    await waitFor(() => expect(mocks.createOneTimeExpense).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ applySafetyMargin: enabled, amountCents: 5000 }) })));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'home'] }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Añadir gasto puntual' })).toHaveFocus();
  });

  it('cancela el modal sin guardar, restaura el foco y conserva los filtros del listado', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByRole('searchbox'), 'ventana');
    const edit = within(screen.getByRole('heading', { name: 'Reparar ventana' }).closest('li')).getByRole('button', { name: 'Editar' });
    await user.click(edit);
    const dialog = screen.getByRole('dialog', { name: 'Editar gasto puntual' });
    expect(within(dialog).getByRole('textbox', { name: 'Nombre' })).toHaveValue('Reparar ventana');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(edit).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(screen.getByRole('searchbox')).toHaveValue('ventana');
    expect(mocks.updateOneTimeExpense).not.toHaveBeenCalled();
  });

  it('mantiene el modal abierto mientras guarda y conserva los datos si falla', async () => {
    const user = userEvent.setup();
    let rejectSave;
    mocks.createOneTimeExpense.mockReturnValue(new Promise((_resolve, reject) => { rejectSave = reject; }));
    renderPage();
    await screen.findByRole('heading', { name: 'Reparar ventana' });
    await user.click(screen.getByRole('button', { name: 'Añadir gasto puntual' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Arreglo');
    await user.type(screen.getByLabelText('Importe (€)'), '20');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto' }));
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cerrar formulario' })).toBeDisabled());
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(dialog).toBeVisible();
    rejectSave(new Error('No se pudo guardar'));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se pudo guardar');
    expect(within(dialog).getByRole('textbox', { name: 'Nombre' })).toHaveValue('Arreglo');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
