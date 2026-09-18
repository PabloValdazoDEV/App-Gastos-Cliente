import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), listPeople: vi.fn(), household: { currentHousehold: { id: 'home', currency: 'EUR' }, isPending: false, isError: false } }));
vi.mock('../features/purchases/purchasesService', () => ({ purchasesService: { list: mocks.list, create: mocks.create } }));
vi.mock('../features/purchases/purchaseDraftsService', () => ({ purchaseDraftsService: { list: vi.fn(async () => []) } }));
vi.mock('../features/households/householdService', () => ({ householdService: { listPeople: mocks.listPeople } }));
vi.mock('../features/households/useHousehold', () => ({ useHousehold: () => mocks.household }));

import { PurchasesPage } from './PurchasesPage';

const phone = { id: 'phone', merchant: 'Apple Store', purchaseDate: '2026-09-17', totalCents: 99900, ownershipType: 'PERSONAL', personalPerson: { id: 'pablo', name: 'Pablo' }, personalPersonId: 'pablo', items: [{ id: 'item-phone', name: 'iPhone 17', brand: 'Apple', model: '17 Pro', quantity: 1, serialNumber: 'ABC123', imei: '123456789012345', warrantyStatus: 'ACTIVE', warrantyEndsAt: '2029-09-17' }] };
const television = { id: 'tv', merchant: 'Electrónica Norte', purchaseDate: '2026-08-10', totalCents: 75000, ownershipType: 'HOUSEHOLD', items: [{ id: 'item-tv', name: 'Televisión', brand: 'LG', model: 'OLED', quantity: 1, warrantyStatus: 'EXPIRING_SOON', warrantyEndsAt: '2026-10-10', warrantyDaysRemaining: 23 }] };

function Destination() { return <p>Ficha {useParams().purchaseId}</p>; }
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const tree = () => <QueryClientProvider client={client}><MemoryRouter initialEntries={['/compras']}><Routes><Route path="/compras" element={<PurchasesPage />} /><Route path="/compras/:purchaseId" element={<Destination />} /></Routes></MemoryRouter></QueryClientProvider>;
  const result = render(tree());
  return { ...result, client, invalidate, refresh: () => result.rerender(tree()) };
}

describe('PurchasesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.household = { currentHousehold: { id: 'home', currency: 'EUR' }, isPending: false, isError: false };
    mocks.list.mockResolvedValue([television, phone]);
    mocks.listPeople.mockResolvedValue({ people: [{ id: 'pablo', name: 'Pablo', isActive: true }, { id: 'natalia', name: 'Natalia', isActive: true }] });
    mocks.create.mockResolvedValue({ id: 'new-purchase' });
  });

  it('muestra vacío útil, un único CTA y ninguna función futura', async () => {
    mocks.list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Todavía no has guardado ninguna compra' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Añadir compra' })).toHaveLength(1);
    expect(screen.queryByText(/IA|OCR|documentos|financiación/)).not.toBeInTheDocument();
    expect(screen.getByText(/El presupuesto recoge los pagos de cada mes/)).toBeVisible();
  });

  it('muestra carga sin inventar compras', () => {
    mocks.list.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Cargando compras')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Todavía no has guardado ninguna compra' })).not.toBeInTheDocument();
  });

  it('sin hogar no consulta compras y explica cómo continuar', () => {
    mocks.household.currentHousehold = null;
    renderPage();
    expect(screen.getByRole('heading', { name: 'Necesitas un hogar' })).toBeVisible();
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('permite reintentar un error de carga accesible', async () => {
    const user = userEvent.setup();
    mocks.list.mockRejectedValueOnce(new Error('Sin conexión'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    await user.click(screen.getByRole('button', { name: 'Volver a intentarlo' }));
    expect(await screen.findByRole('link', { name: 'iPhone 17' })).toHaveAttribute('href', '/compras/phone');
  });

  it('ordena por fecha, muestra importes y propiedad sin exponer serie ni IMEI', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'iPhone 17' });
    const cards = screen.getAllByRole('listitem');
    expect(cards[0]).toHaveTextContent('iPhone 17');
    expect(cards[1]).toHaveTextContent('Televisión');
    expect(cards[0]).toHaveTextContent('999,00 €');
    expect(cards[0]).toHaveTextContent('Pablo');
    expect(cards[0]).toHaveTextContent('Vigente hasta 17 sept 2029');
    expect(screen.queryByText('ABC123')).not.toBeInTheDocument();
    expect(screen.queryByText('123456789012345')).not.toBeInTheDocument();
  });

  it('separa años y meses por fecha de compra y elimina grupos vacíos al buscar', async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([
      { ...television, purchaseDate: '2025-09-10' },
      { ...phone, purchaseDate: '2026-01-01T00:00:00.000Z' },
      { ...television, id: 'recent-tv', purchaseDate: '2026-09-10' },
    ]);
    renderPage();
    const year = await screen.findByRole('region', { name: '2026' });
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['2026', '2025']);
    expect(within(year).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Septiembre', 'Enero']);
    expect(within(within(year).getByRole('region', { name: 'Enero' })).getByRole('link', { name: 'iPhone 17' })).toBeVisible();
    expect(within(screen.getByRole('region', { name: '2025' })).getByRole('link', { name: 'Televisión' })).toBeVisible();
    await user.type(screen.getByRole('searchbox'), 'iPhone');
    expect(screen.queryByRole('region', { name: '2025' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Septiembre' })).not.toBeInTheDocument();
  });

  it.each(['Apple Store', '999,00 €', 'Vigente hasta 17 sept 2029', 'Ver compra'])('abre la ficha pulsando en cualquier zona de la tarjeta: %s', async (text) => {
    const user = userEvent.setup();
    renderPage();
    const card = await screen.findByRole('link', { name: 'iPhone 17' });
    expect(card).toHaveAttribute('href', '/compras/phone');
    expect(card).toHaveAccessibleDescription('Ver compra');
    const target = within(card).getByText(text);
    expect(target.closest('a')).toBe(card);
    await user.click(target);
    expect(await screen.findByText('Ficha phone')).toBeVisible();
  });

  it('ofrece una sola parada de teclado por tarjeta y abre con Enter', async () => {
    const user = userEvent.setup();
    renderPage();
    const card = await screen.findByRole('link', { name: 'iPhone 17' });
    expect(card.querySelector('a, button, input, [tabindex]')).toBeNull();
    expect(card).toHaveClass('h-full', 'p-5', 'focus-visible:outline-2');
    card.focus();
    await user.tab();
    const next = screen.getByRole('link', { name: 'Televisión' });
    expect(next).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Ficha tv')).toBeVisible();
  });

  it.each(['iPhone', 'Apple', '17 Pro', 'Apple Store'])('busca por producto, marca, modelo o comercio: %s', async (term) => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByRole('searchbox', { name: 'Buscar compras' }), term);
    expect(screen.getByRole('link', { name: 'iPhone 17' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Televisión' })).not.toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });

  it('busca todos los productos pero resume garantías por producto en la tarjeta', async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([{ ...phone, items: [...phone.items, { id: 'cable', name: 'Cable USB', brand: 'Anker', warrantyStatus: 'NONE' }] }]);
    renderPage();
    await user.type(await screen.findByRole('searchbox'), 'Anker');
    expect(screen.getByRole('link', { name: 'iPhone 17' })).toBeVisible();
    expect(screen.getByText('2 productos')).toBeVisible();
    expect(screen.getByText('Garantías por producto: 1 vigente · 1 sin garantía')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Cable USB' })).not.toBeInTheDocument();
  });

  it('oculta los filtros inicialmente, combina propiedad/garantía y limpia resultados', async () => {
    const user = userEvent.setup();
    renderPage();
    const toggle = await screen.findByRole('button', { name: 'Filtrar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.click(toggle);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Propiedad' }), 'HOUSEHOLD');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Garantía' }), 'EXPIRING_SOON');
    expect(screen.getByRole('button', { name: 'Filtrar 2 activos' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Televisión' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'iPhone 17' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('Vigente incluye garantías próximas a caducar', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Filtrar' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Garantía' }), 'ACTIVE');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('recupera el listado tras una búsqueda sin resultados', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByRole('searchbox'), 'inexistente');
    expect(screen.getByText(/No hay compras que coincidan/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByRole('link', { name: 'iPhone 17' })).toBeVisible();
  });

  it('abre por teclado, enfoca el formulario y devuelve foco al cancelar', async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([]);
    renderPage();
    const button = await screen.findByRole('button', { name: 'Añadir compra' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByLabelText('Subir ticket o factura')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Introducir sin archivo' }));
    const form = await screen.findByRole('form', { name: 'Añadir compra' });
    expect(screen.getByRole('heading', { name: 'Revisa y guarda tu compra' })).toHaveFocus();
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Añadir compra' })).toHaveFocus();
  });

  it('guarda compra común y refresca solo el dominio de compras antes de abrir ficha', async () => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Añadir compra' }));
    await user.click(await screen.findByRole('button', { name: 'Introducir sin archivo' }));
    const form = await screen.findByRole('form', { name: 'Añadir compra' });
    await user.type(within(form).getByLabelText('Total de la compra (€)'), '999');
    await user.type(within(form).getByLabelText('Nombre del producto'), 'iPhone 17');
    await user.click(within(form).getByRole('button', { name: 'Guardar compra' }));
    expect(await screen.findByText('Ficha new-purchase')).toBeVisible();
    expect(mocks.create).toHaveBeenCalledWith({ householdId: 'home', body: expect.objectContaining({ ownershipType: 'HOUSEHOLD', totalCents: 99900, items: [expect.objectContaining({ name: 'iPhone 17' })] }) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['purchases', 'home'], exact: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['purchases', 'home', 'detail', 'new-purchase'], exact: true });
    expect(invalidate.mock.calls.map(([options]) => options.queryKey[0])).toEqual(expect.arrayContaining(['purchases', 'budget', 'dashboard', 'calendar', 'simulation', 'plannings', 'monthlyPlanning']));
  });

  it('no abre una ficha si la propiedad guardada revoca el acceso', async () => {
    const user = userEvent.setup();
    mocks.create.mockResolvedValue({ id: 'private', accessRevoked: true });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Añadir compra' }));
    await user.click(await screen.findByRole('button', { name: 'Introducir sin archivo' }));
    const form = await screen.findByRole('form', { name: 'Añadir compra' });
    await user.type(within(form).getByLabelText('Total de la compra (€)'), '10');
    await user.type(within(form).getByLabelText('Nombre del producto'), 'Regalo');
    await user.click(within(form).getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Añadir compra' })).toHaveFocus();
    expect(screen.queryByText('Ficha private')).not.toBeInTheDocument();
  });

  it('mantiene los datos ante error de guardado y muestra alerta accesible', async () => {
    const user = userEvent.setup();
    mocks.create.mockRejectedValue(new Error('No se pudo guardar. Inténtalo de nuevo.'));
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Añadir compra' }));
    await user.click(await screen.findByRole('button', { name: 'Introducir sin archivo' }));
    const form = await screen.findByRole('form', { name: 'Añadir compra' });
    await user.type(within(form).getByLabelText('Total de la compra (€)'), '10');
    await user.type(within(form).getByLabelText('Nombre del producto'), 'Regalo');
    await user.click(within(form).getByRole('button', { name: 'Guardar compra' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
    expect(within(form).getByLabelText('Nombre del producto')).toHaveValue('Regalo');
  });

  it('permite cancelar si no se pueden cargar las personas del hogar', async () => {
    const user = userEvent.setup();
    mocks.listPeople.mockRejectedValue(new Error('Personas no disponibles'));
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Añadir compra' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Personas no disponibles');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Añadir compra' })).toHaveFocus();
  });

  it('descarta formularios y filtros al cambiar de hogar', async () => {
    const user = userEvent.setup();
    const { refresh } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Añadir compra' }));
    await user.click(await screen.findByRole('button', { name: 'Introducir sin archivo' }));
    await screen.findByRole('form', { name: 'Añadir compra' });
    mocks.household = { ...mocks.household, currentHousehold: { id: 'other', currency: 'EUR' } };
    mocks.list.mockResolvedValue([]);
    refresh();
    expect(await screen.findByRole('heading', { name: 'Todavía no has guardado ninguna compra' })).toBeVisible();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledWith('other');
  });
});
