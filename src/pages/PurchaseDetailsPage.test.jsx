import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ detail: vi.fn(), update: vi.fn(), archive: vi.fn(), createItem: vi.fn(), updateItem: vi.fn(), deleteItem: vi.fn(), listPeople: vi.fn(), documents: vi.fn(), household: { currentHousehold: { id: 'home', currency: 'EUR' }, isPending: false, isError: false } }));
vi.mock('../features/purchases/purchasesService', () => ({ purchasesService: { detail: mocks.detail, update: mocks.update, archive: mocks.archive, createItem: mocks.createItem, updateItem: mocks.updateItem, deleteItem: mocks.deleteItem } }));
vi.mock('../features/households/householdService', () => ({ householdService: { listPeople: mocks.listPeople } }));
vi.mock('../features/households/useHousehold', () => ({ useHousehold: () => mocks.household }));
vi.mock('../features/purchases/purchaseDocumentsService', () => ({ purchaseDocumentsService: { list: mocks.documents, contentUrl: () => '/api/private-document' } }));

import { PurchaseDetailsPage } from './PurchaseDetailsPage';

const phoneItem = { id: 'item-phone', name: 'iPhone 17', brand: 'Apple', model: '17', quantity: 1, priceCents: 99900, serialNumber: 'ABC123', imei: '123456789012345', warrantyStatus: 'ACTIVE', warrantyEndsAt: '2029-09-17', warrantySource: 'DURATION', warrantyDurationMonths: 36, warrantyDaysRemaining: 1096, notes: 'Móvil principal' };
const purchase = { id: 'phone', merchant: 'Apple Store', purchaseDate: '2026-09-17', totalCents: 99900, ownershipType: 'PERSONAL', personalPerson: { id: 'pablo', name: 'Pablo' }, personalPersonId: 'pablo', notes: 'Recogida en tienda', items: [phoneItem], shares: [] };
const cable = { id: 'cable', name: 'Cable USB', quantity: 1, warrantyStatus: 'NONE' };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const remove = vi.spyOn(client, 'removeQueries');
  const tree = () => <QueryClientProvider client={client}><MemoryRouter initialEntries={['/compras/phone']}><Routes><Route path="/compras/:purchaseId" element={<PurchaseDetailsPage />} /><Route path="/compras" element={<h1>Listado de compras</h1>} /></Routes></MemoryRouter></QueryClientProvider>;
  const result = render(tree());
  return { ...result, client, invalidate, remove, refresh: () => result.rerender(tree()) };
}

describe('PurchaseDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.household = { currentHousehold: { id: 'home', currency: 'EUR' }, isPending: false, isError: false };
    mocks.detail.mockResolvedValue(purchase);
    mocks.update.mockResolvedValue(purchase);
    mocks.createItem.mockResolvedValue(purchase);
    mocks.updateItem.mockResolvedValue(purchase);
    mocks.deleteItem.mockResolvedValue(purchase);
    mocks.archive.mockResolvedValue({ id: 'phone', archivedAt: '2026-09-17' });
    mocks.listPeople.mockResolvedValue({ people: [{ id: 'pablo', name: 'Pablo' }, { id: 'natalia', name: 'Natalia' }] });
    mocks.documents.mockResolvedValue([]);
  });

  it('muestra cabecera, productos e identificadores solo en ficha', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'iPhone 17' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Datos de compra' })).toHaveTextContent('Apple Store');
    expect(screen.getByRole('region', { name: 'Datos de compra' })).toHaveTextContent('Pablo');
    expect(screen.getByText('ABC123')).toBeVisible();
    expect(screen.getByText('123456789012345')).toBeVisible();
    expect(screen.getByText('Móvil principal')).toBeVisible();
    expect(screen.getByText('Vigente hasta 17 sept 2029')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Volver a Compras' })).toHaveAttribute('href', '/compras');
    expect(screen.getByText(/Su forma de pago determina el presupuesto/i)).toBeVisible();
    expect(await screen.findByText('No hay documentos guardados.')).toBeVisible();
    expect(mocks.documents).toHaveBeenCalledWith(expect.objectContaining({ householdId: 'home', purchaseId: 'phone' }));
  });

  it.each([
    ['NONE', null, null, 'Sin garantía'],
    ['ACTIVE', '2029-09-17', 1096, 'Vigente hasta 17 sept 2029'],
    ['EXPIRING_SOON', '2026-10-10', 23, 'Caduca en 23 días'],
    ['EXPIRING_SOON', '2026-09-18', 1, 'Caduca en 1 día'],
    ['EXPIRING_SOON', '2026-09-17', 0, 'Caduca hoy'],
    ['EXPIRED', '2025-09-17', -365, 'Caducó el 17 sept 2025'],
  ])('presenta %s derivado por la API sin inferir garantías legales', async (warrantyStatus, warrantyEndsAt, warrantyDaysRemaining, label) => {
    mocks.detail.mockResolvedValue({ ...purchase, items: [{ ...phoneItem, warrantyStatus, warrantyEndsAt, warrantyDaysRemaining }] });
    renderPage();
    expect(await screen.findByText(label)).toBeVisible();
  });

  it('muestra los porcentajes de compra repartida sin convertirlos en pagos', async () => {
    mocks.detail.mockResolvedValue({ ...purchase, ownershipType: 'SPLIT', personalPersonId: null, personalPerson: null, shares: [{ householdPersonId: 'pablo', shareBps: 6000, householdPerson: { name: 'Pablo' } }, { householdPersonId: 'natalia', shareBps: 4000, householdPerson: { name: 'Natalia' } }] });
    renderPage();
    const shares = await screen.findByRole('list', { name: 'Reparto de propiedad' });
    expect(shares).toHaveTextContent('Pablo60 %');
    expect(shares).toHaveTextContent('Natalia40 %');
    expect(within(shares).queryByText(/pago|cuota/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Pago sin confirmar/)).toBeVisible();
  });

  it('muestra carga y no expone contenido anterior', () => {
    mocks.detail.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Cargando compra')).toBeInTheDocument();
    expect(screen.queryByText('ABC123')).not.toBeInTheDocument();
  });

  it('gestiona compra invisible o archivada sin revelar detalles', async () => {
    mocks.detail.mockRejectedValue(Object.assign(new Error('No encontrada'), { status: 404 }));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Puede estar archivada o no estar disponible para ti');
    expect(screen.queryByText('Apple Store')).not.toBeInTheDocument();
  });

  it('edita metadata, no manda items y refresca solo lista y detalle de compras', async () => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Editar compra' }));
    const form = await screen.findByRole('form', { name: 'Editar compra' });
    expect(within(form).getByLabelText('Fecha de compra')).toHaveFocus();
    await user.clear(within(form).getByLabelText('Tienda (opcional)'));
    await user.type(within(form).getByLabelText('Tienda (opcional)'), 'Apple Valencia');
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios de la compra' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    const args = mocks.update.mock.calls[0][0];
    expect(args).toMatchObject({ householdId: 'home', purchaseId: 'phone', body: { merchant: 'Apple Valencia', totalCents: 99900, ownershipType: 'PERSONAL', personalPersonId: 'pablo' } });
    expect(args.body).not.toHaveProperty('items');
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Editar compra' })).toHaveFocus();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['purchases', 'home'], exact: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['purchases', 'home', 'detail', 'phone'], exact: true });
    expect(invalidate.mock.calls.map(([options]) => options.queryKey[0])).toEqual(expect.arrayContaining(['purchases', 'budget', 'dashboard', 'calendar']));
  });

  it('cancelar edición devuelve foco al botón que abrió el formulario', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Editar iPhone 17' }));
    const form = await screen.findByRole('form', { name: 'Editar producto' });
    expect(within(form).getByLabelText('Nombre del producto')).toHaveFocus();
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Editar iPhone 17' })).toHaveFocus();
  });

  it('separa financiación de productos y documentos y evita editar la compra durante un pago', async () => {
    const user = userEvent.setup();
    const installment = { id: 'inst', sequence: 1, dueDate: '2026-10-17', expectedAmountCents: 5500, status: 'PLANNED', canRegisterPayment: true };
    mocks.detail.mockResolvedValue({ ...purchase, paymentMethod: 'FINANCED', financing: {
      id: 'financing', downPaymentCents: 0, financedPrincipalCents: 99900, financingTotalCents: 110000, installments: [installment],
      progress: { paidCents: 0, pendingCents: 110000, paidInstallmentCount: 0, installmentCount: 20, nextInstallment: installment, costOfFinancingCents: 10100, totalCostCents: 110000 },
    } });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Marcar cuota 1 como pagada' }));
    expect(screen.getByRole('form', { name: 'Pagar de cuota 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Editar compra' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Archivar compra' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Añadir producto' })).toBeDisabled();
    expect(await screen.findByText('No hay documentos guardados.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Editar compra' })).toBeEnabled();
  });

  it('muestra error de edición sin perder los datos introducidos', async () => {
    const user = userEvent.setup();
    mocks.update.mockRejectedValue(new Error('No se puede guardar ahora'));
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Editar compra' }));
    const form = await screen.findByRole('form', { name: 'Editar compra' });
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios de la compra' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede guardar ahora');
    expect(form).toBeInTheDocument();
  });

  it('limpia ficha cacheada y vuelve al listado si una edición revoca acceso', async () => {
    const user = userEvent.setup();
    mocks.update.mockResolvedValue({ id: 'phone', accessRevoked: true });
    const { client, remove } = renderPage();
    client.setQueryData(['purchases', 'home'], [purchase]);
    await user.click(await screen.findByRole('button', { name: 'Editar compra' }));
    const form = await screen.findByRole('form', { name: 'Editar compra' });
    await user.selectOptions(within(form).getByRole('combobox', { name: 'Persona propietaria' }), 'natalia');
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios de la compra' }));
    expect(await screen.findByRole('heading', { name: 'Listado de compras' })).toBeVisible();
    expect(remove).toHaveBeenCalledWith({ queryKey: ['purchases', 'home', 'detail', 'phone'], exact: true });
    expect(client.getQueryData(['purchases', 'home', 'detail', 'phone'])).toBeUndefined();
    expect(remove).toHaveBeenCalledWith({ queryKey: ['purchases', 'home', 'documents', 'phone'], exact: true });
    expect(client.getQueryData(['purchases', 'home', 'documents', 'phone'])).toBeUndefined();
    expect(client.getQueryData(['purchases', 'home'])).toEqual([]);
    expect(mocks.detail).toHaveBeenCalledTimes(1);
  });

  it('añade un producto y refresca la ficha sin alterar el total', async () => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Añadir producto' }));
    const form = screen.getByRole('form', { name: 'Añadir producto' });
    await user.type(within(form).getByLabelText('Nombre del producto'), 'Cable USB');
    await user.click(within(form).getByRole('button', { name: 'Guardar producto' }));
    await waitFor(() => expect(mocks.createItem).toHaveBeenCalled());
    expect(mocks.createItem.mock.calls[0][0]).toMatchObject({ householdId: 'home', purchaseId: 'phone', body: { name: 'Cable USB', quantity: 1, priceCents: null } });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(invalidate.mock.calls.map(([options]) => options.queryKey[0])).toEqual(expect.arrayContaining(['purchases', 'budget', 'dashboard', 'calendar']));
  });

  it('edita garantía del producto sin reenviar fecha calculada como explícita', async () => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Editar iPhone 17' }));
    const form = screen.getByRole('form', { name: 'Editar producto' });
    await user.clear(within(form).getByLabelText('Duración de la garantía'));
    await user.type(within(form).getByLabelText('Duración de la garantía'), '4');
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios del producto' }));
    await waitFor(() => expect(mocks.updateItem).toHaveBeenCalled());
    expect(mocks.updateItem.mock.calls[0][0]).toMatchObject({ householdId: 'home', purchaseId: 'phone', itemId: 'item-phone', body: { warrantyDurationMonths: 48, warrantyEndsAt: null } });
    expect(invalidate.mock.calls.map(([options]) => options.queryKey[0])).toEqual(expect.arrayContaining(['purchases', 'budget', 'dashboard', 'calendar']));
  });

  it('no permite eliminar el último producto y explica la alternativa', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Eliminar iPhone 17' })).toBeDisabled();
    expect(screen.getByText(/La compra debe conservar al menos un producto/)).toBeVisible();
    expect(mocks.deleteItem).not.toHaveBeenCalled();
  });

  it('confirma eliminación de producto, conserva total y devuelve foco a Productos', async () => {
    const user = userEvent.setup();
    mocks.detail.mockResolvedValue({ ...purchase, items: [phoneItem, cable] });
    const { invalidate } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Eliminar Cable USB' }));
    expect(mocks.deleteItem).not.toHaveBeenCalled();
    mocks.detail.mockResolvedValue(purchase);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar producto' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mocks.deleteItem.mock.calls[0][0]).toEqual({ householdId: 'home', purchaseId: 'phone', itemId: 'cable' });
    expect(screen.getByRole('heading', { name: 'Productos (1)' })).toHaveFocus();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['purchases', 'home', 'detail', 'phone'], exact: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['purchases', 'home', 'documents', 'phone'], exact: true });
  });

  it('archivado requiere confirmación, atrapa Tab y Escape restaura foco', async () => {
    const user = userEvent.setup();
    renderPage();
    const trigger = await screen.findByRole('button', { name: 'Archivar compra' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '¿Archivar esta compra?' });
    const cancel = within(dialog).getByRole('button', { name: 'Cancelar' });
    const confirm = within(dialog).getByRole('button', { name: 'Archivar compra' });
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    expect(mocks.archive).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('archiva y vuelve al listado, eliminando el detalle cacheado', async () => {
    const user = userEvent.setup();
    const { invalidate, remove } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Archivar compra' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archivar compra' }));
    expect(await screen.findByRole('heading', { name: 'Listado de compras' })).toBeVisible();
    expect(mocks.archive.mock.calls[0][0]).toEqual({ householdId: 'home', purchaseId: 'phone' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['purchases', 'home'], exact: true });
    expect(remove).toHaveBeenCalledWith({ queryKey: ['purchases', 'home', 'detail', 'phone'], exact: true });
    expect(invalidate.mock.calls.map(([options]) => options.queryKey[0])).toEqual(expect.arrayContaining(['purchases', 'budget', 'dashboard', 'calendar']));
  });

  it('un error de archivado permanece en el diálogo y permite cancelar', async () => {
    const user = userEvent.setup();
    mocks.archive.mockRejectedValue(new Error('No se pudo archivar'));
    renderPage();
    const trigger = await screen.findByRole('button', { name: 'Archivar compra' });
    await user.click(trigger);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archivar compra' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo archivar');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(trigger).toHaveFocus();
  });

  it('al cambiar hogar descarta formulario y no conserva identificadores del anterior', async () => {
    const user = userEvent.setup();
    const { refresh } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Editar compra' }));
    await screen.findByRole('form', { name: 'Editar compra' });
    mocks.household = { ...mocks.household, currentHousehold: { id: 'other', currency: 'EUR' } };
    mocks.detail.mockRejectedValue(Object.assign(new Error('No encontrada'), { status: 404 }));
    refresh();
    expect(await screen.findByRole('alert')).toHaveTextContent('no estar disponible para ti');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByText('ABC123')).not.toBeInTheDocument();
  });
});
