import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), upload: vi.fn(), analyze: vi.fn(), confirm: vi.fn(), remove: vi.fn(), create: vi.fn() }));
vi.mock('./purchaseDraftsService', () => ({ purchaseDraftsService: api }));
vi.mock('./purchasesService', () => ({ purchasesService: { create: api.create } }));
import { PurchaseCreateFlow } from './PurchaseCreateFlow';

const draft = { id: 'draft', filename: 'ticket.pdf' };
const analysis = { id: 'analysis', status: 'COMPLETED', extractedData: { currency: 'EUR', merchant: { name: 'Tienda' }, purchaseDate: { value: '2020-01-10' }, totalCents: 870, warnings: [], items: [
  { name: 'Producto A', quantity: 1, totalPriceCents: 550, confidence: 'HIGH' },
  { name: 'Producto B', quantity: 1, totalPriceCents: 320, confidence: 'HIGH' },
] } };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onCreated = vi.fn(); const onCancel = vi.fn();
  const view = render(<QueryClientProvider client={client}><PurchaseCreateFlow householdId="home" currency="EUR" timezone="Europe/Madrid" people={[]} onCreated={onCreated} onCancel={onCancel} /></QueryClientProvider>);
  return { ...view, client, onCreated, onCancel, user: userEvent.setup() };
}
async function upload(user) {
  await user.upload(screen.getByLabelText('Subir ticket o factura'), new File(['%PDF-1.4'], 'ticket.pdf', { type: 'application/pdf' }));
  await screen.findByText('Archivo: ticket.pdf');
}
beforeEach(() => {
  vi.resetAllMocks(); api.list.mockResolvedValue([]); api.upload.mockResolvedValue(draft);
  api.analyze.mockResolvedValue(analysis); api.confirm.mockResolvedValue({ id: 'saved' }); api.create.mockResolvedValue({ id: 'manual' });
});
describe('PurchaseCreateFlow', () => {
  it('offers upload first, requires consent, selects one product and only saves reviewed data', async () => {
    const { user, onCreated } = setup();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    await upload(user);
    expect(api.create).not.toHaveBeenCalled(); expect(api.confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Analizar y rellenar con IA' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Autorizo enviar/ }));
    await user.click(screen.getByRole('button', { name: 'Analizar y rellenar con IA' }));
    const next = await screen.findByRole('button', { name: 'Revisar datos de este producto' });
    expect(next).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Producto B' })); await user.click(next);
    expect(screen.getByLabelText('Nombre del producto')).toHaveValue('Producto B');
    expect(screen.getByLabelText('Cantidad')).toBeVisible();
    expect(screen.getByLabelText('Cantidad')).toHaveValue('1');
    expect(screen.getByLabelText('Fecha de compra')).toHaveValue('2020-01-10');
    expect(screen.getByLabelText('Total de la compra (€)')).toHaveValue('3.20');
    expect(screen.queryByRole('button', { name: 'Añadir otro producto' })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Total de la compra (€)')); await user.type(screen.getByLabelText('Total de la compra (€)'), '4');
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'saved' }));
    expect(api.confirm).toHaveBeenCalledWith({ householdId: 'home', draftId: 'draft', body: expect.objectContaining({ analysisId: 'analysis', currency: 'EUR', purchase: expect.objectContaining({ totalCents: 400, paidAmountCents: 400, items: [expect.objectContaining({ name: 'Producto B', priceCents: 400 })] }) }) });
    expect(api.analyze).toHaveBeenCalledTimes(1); expect(api.create).not.toHaveBeenCalled();
  });
  it('retains the file and permits manual completion after an AI error', async () => {
    api.analyze.mockRejectedValue(new Error('IA no disponible'));
    const { user, onCreated } = setup(); await upload(user);
    await user.click(screen.getByRole('checkbox')); await user.click(screen.getByRole('button', { name: 'Analizar y rellenar con IA' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('IA no disponible');
    await user.click(screen.getByRole('button', { name: 'Rellenar manualmente y conservar archivo' }));
    await user.type(screen.getByLabelText('Nombre del producto'), 'Manual'); await user.type(screen.getByLabelText('Total de la compra (€)'), '12');
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(api.confirm.mock.calls[0][0]).toMatchObject({ draftId: 'draft', body: { analysisId: null, purchase: { totalCents: 1200 } } });
  });
  it('resumes a previous successful analysis without paying for another analysis', async () => {
    api.list.mockResolvedValue([draft]); api.get.mockResolvedValue({ ...draft, analyses: [analysis] });
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Continuar ticket.pdf' }));
    expect(await screen.findByRole('radio', { name: 'Producto A' })).toBeVisible();
    expect(api.analyze).not.toHaveBeenCalled();
  });
  it('asks before deleting a draft and makes no purchase mutation', async () => {
    api.list.mockResolvedValue([draft]); api.remove.mockResolvedValue({ deleted: true });
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Eliminar ticket.pdf' }));
    expect(api.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Eliminar borrador' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith({ householdId: 'home', draftId: 'draft' }));
    expect(api.confirm).not.toHaveBeenCalled();
  });
  it('retains edited values on failed confirmation and retries without uploading or analyzing again', async () => {
    api.confirm.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce({ id: 'saved' });
    const { user, onCreated } = setup(); await upload(user);
    await user.click(screen.getByRole('button', { name: 'Rellenar manualmente y conservar archivo' }));
    await user.type(screen.getByLabelText('Nombre del producto'), 'Conservado'); await user.type(screen.getByLabelText('Total de la compra (€)'), '12');
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    expect(screen.getByLabelText('Nombre del producto')).toHaveValue('Conservado');
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(api.confirm.mock.calls[0][0]).toEqual(api.confirm.mock.calls[1][0]); expect(api.upload).toHaveBeenCalledOnce(); expect(api.analyze).not.toHaveBeenCalled();
  });
  it('prefills and saves detected units, date and documented warranty without changing the original extraction', async () => {
    const detected = { ...analysis, extractedData: { ...analysis.extractedData, purchaseDate: { value: '2024-02-29' }, items: [{ ...analysis.extractedData.items[0], quantity: 3, warranty: { durationMonths: 24, endsAt: null } }] } };
    api.analyze.mockResolvedValue(detected);
    const { user, onCreated } = setup(); await upload(user);
    await user.click(screen.getByRole('checkbox')); await user.click(screen.getByRole('button', { name: 'Analizar y rellenar con IA' }));
    await user.click(await screen.findByRole('button', { name: 'Revisar datos de este producto' }));
    expect(screen.getByLabelText('Cantidad')).toHaveValue('3');
    expect(screen.getByLabelText('Fecha de compra')).toHaveValue('2024-02-29');
    expect(screen.getByRole('checkbox', { name: 'Tiene garantía' })).toBeChecked();
    expect(screen.getByLabelText('Duración de la garantía')).toHaveValue('2');
    expect(screen.getByText('Hasta el 28 feb 2026')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(api.confirm.mock.calls[0][0].body.purchase).toMatchObject({ purchaseDate: '2024-02-29', items: [{ quantity: 3, warrantyDurationMonths: 24, warrantyEndsAt: null }] });
    expect(detected.extractedData.items[0].quantity).toBe(3);
  });
  it('makes unknown units an explicit editable suggestion and retains missing dates as required', async () => {
    api.analyze.mockResolvedValue({ ...analysis, extractedData: { ...analysis.extractedData, purchaseDate: { value: null }, items: [{ ...analysis.extractedData.items[0], quantity: null, unitPriceCents: null }] } });
    const { user } = setup(); await upload(user);
    await user.click(screen.getByRole('checkbox')); await user.click(screen.getByRole('button', { name: 'Analizar y rellenar con IA' }));
    await user.click(await screen.findByRole('button', { name: 'Revisar datos de este producto' }));
    expect(screen.getByLabelText('Cantidad')).toHaveValue('1');
    expect(screen.getByLabelText('Cantidad')).toHaveAccessibleDescription(/no ha identificado las unidades/);
    expect(screen.getByLabelText('Fecha de compra')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    expect(await screen.findByText('Indica una fecha de compra válida.')).toBeVisible();
    expect(api.confirm).not.toHaveBeenCalled();
  });
  it('requires fresh consent when reanalyzing a resumed draft', async () => {
    api.list.mockResolvedValue([draft]); api.get.mockResolvedValue({ ...draft, analyses: [analysis] });
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Continuar ticket.pdf' }));
    await user.click(await screen.findByRole('button', { name: 'Repetir análisis de este archivo' }));
    expect(screen.getByRole('button', { name: 'Analizar y rellenar con IA' })).toBeDisabled();
    expect(api.analyze).not.toHaveBeenCalled();
  });
});
