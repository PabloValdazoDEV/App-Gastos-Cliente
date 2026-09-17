import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ list: vi.fn(), analyze: vi.fn(), confirm: vi.fn(), documents: vi.fn(), remove: vi.fn() }));
vi.mock('./purchaseDocumentAnalysesService', async (original) => ({ ...await original(), purchaseDocumentAnalysesService: { list: mocks.list, analyze: mocks.analyze, confirm: mocks.confirm } }));
vi.mock('./purchaseDocumentsService', () => ({ purchaseDocumentsService: { list: mocks.documents, remove: mocks.remove, contentUrl: () => '/private-document' } }));

import { queryKeys } from '../../api/queryKeys';
import { PurchaseDocumentsPanel } from './PurchaseDocumentsPanel';
import { analysisPurchaseFixture as purchase, receiptAnalysisFixture as analysis } from './purchaseAnalysisFixtures';

const document = { id: 'document', filename: 'ticket.pdf', contentType: 'application/pdf', type: 'RECEIPT', sizeBytes: 200, createdAt: '2026-09-17T12:00:00Z' };
const deferred = () => { let resolve; let reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries'); const onBusyChange = vi.fn();
  const tree = (props) => <QueryClientProvider client={client}><PurchaseDocumentsPanel householdId="home" onBusyChange={onBusyChange} purchase={purchase} {...props} /></QueryClientProvider>;
  const view = render(tree());
  return { ...view, client, invalidate, onBusyChange, refresh: (props) => view.rerender(tree(props)) };
}
async function openAnalyze(user) {
  await user.click(await screen.findByRole('button', { name: 'Analizar con IA ticket.pdf' }));
  return screen.getByRole('region', { name: 'Confirmar envío a OpenAI' });
}
async function openHistory(user) {
  await user.click(await screen.findByRole('button', { name: 'Ver análisis de ticket.pdf' }));
  return screen.findByRole('form', { name: 'Revisar datos detectados' });
}

describe('PurchaseDocumentAnalysisPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.documents.mockResolvedValue([document]); mocks.list.mockResolvedValue([]);
    mocks.analyze.mockImplementation(async () => { mocks.list.mockResolvedValue([analysis]); return analysis; });
    mocks.confirm.mockImplementation(async () => {
      const confirmed = { ...analysis, status: 'CONFIRMED', confirmedAt: '2026-09-17T13:00:00Z' };
      mocks.list.mockResolvedValue([confirmed]);
      return { analysis: confirmed, purchase: { ...purchase, merchant: 'Mercadona', totalCents: 870 } };
    });
  });
  it('offers analysis only for compatible files without eager analysis or history requests', async () => {
    mocks.documents.mockResolvedValue(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'].map((contentType, index) => ({ ...document, id: `d${index}`, filename: `f${index}`, contentType })));
    setup();
    expect(await screen.findAllByRole('button', { name: /^Analizar con IA/ })).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Analizar con IA f4' })).not.toBeInTheDocument();
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it('requires explicit contextual consent before any provider operation and permits cancellation', async () => {
    const user = userEvent.setup(); const { onBusyChange } = setup();
    const consent = await openAnalyze(user);
    expect(consent).toHaveTextContent('Se enviará una copia a OpenAI');
    expect(within(consent).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(mocks.analyze).not.toHaveBeenCalled();
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    await user.click(within(consent).getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar análisis' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Analizar con IA ticket.pdf' })).toHaveFocus());
    expect(onBusyChange).toHaveBeenLastCalledWith(false); expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it('shows independent loading, prevents double clicks and never saves or invalidates finances while analyzing', async () => {
    const user = userEvent.setup(); const pending = deferred(); mocks.analyze.mockReturnValue(pending.promise);
    const { invalidate } = setup();
    await openAnalyze(user);
    await user.dblClick(screen.getByRole('button', { name: 'Enviar a OpenAI y analizar' }));
    expect(mocks.analyze).toHaveBeenCalledOnce();
    expect(mocks.analyze.mock.calls[0][0]).toEqual({ householdId: 'home', purchaseId: 'purchase', documentId: 'document' });
    expect(screen.getByText(/Analizando documento…/)).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: 'Eliminar ticket.pdf' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Ver ticket.pdf (abre otra pestaña)' })).toHaveAttribute('href', '/private-document');
    mocks.list.mockResolvedValue([analysis]);
    await act(async () => pending.resolve(analysis));
    expect(await screen.findByRole('form', { name: 'Revisar datos detectados' })).toBeVisible();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(invalidate.mock.calls.every(([options]) => options.queryKey.includes('analyses'))).toBe(true);
  });
  it('confirms final reviewed values and then refreshes purchase, documents, analyses and financial views', async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([analysis]);
    const { invalidate, client } = setup(); await openHistory(user);
    await user.clear(screen.getByLabelText('Comercio')); await user.type(screen.getByLabelText('Comercio'), 'Revisado');
    await user.click(screen.getByLabelText('Añadir estos productos a la compra'));
    await user.click(screen.getByRole('button', { name: 'Confirmar datos' }));
    await screen.findByText('Este análisis ya está confirmado.');
    expect(mocks.confirm.mock.calls[0][0]).toMatchObject({ householdId: 'home', purchaseId: 'purchase', documentId: 'document', analysisId: 'analysis', body: { purchaseVersion: 'version-1', reviewedData: { merchant: 'Revisado' }, apply: { items: 'ADD' } } });
    expect(invalidate.mock.calls.map(([options]) => options.queryKey[0])).toEqual(expect.arrayContaining(['budget', 'dashboard', 'calendar', 'simulation', 'plannings', 'monthlyPlanning']));
    expect(client.getQueryData(queryKeys.purchases.detail('home', 'purchase')).merchant).toBe('Mercadona');
    expect(screen.queryByRole('button', { name: 'Confirmar datos' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Análisis del documento' })).toHaveFocus());
  });
  it('cancels only the edited draft, keeps server analysis, clears private review cache and can reopen it', async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([analysis]); const { client } = setup();
    await openHistory(user); await user.type(screen.getByLabelText('Comercio'), ' borrador');
    await user.click(screen.getByRole('button', { name: 'Cancelar revisión' }));
    expect(screen.queryByRole('form')).not.toBeInTheDocument(); expect(mocks.confirm).not.toHaveBeenCalled();
    expect(client.getQueryData(queryKeys.purchases.analyses('home', 'purchase', 'document'))).toBeUndefined();
    await openHistory(user); expect(screen.getByLabelText('Comercio')).toHaveValue('Mercadona');
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it.each([
    [{ code: 'AI_NOT_CONFIGURED' }, 'El análisis con IA no está configurado'],
    [{ status: 429 }, 'Has realizado varios análisis en poco tiempo'],
    [{ status: 502 }, 'No se ha podido analizar el documento. Inténtalo de nuevo.'],
  ])('shows safe actionable analysis errors without raw provider detail or automatic retries: %j', async (properties, message) => {
    const user = userEvent.setup(); mocks.analyze.mockRejectedValue(Object.assign(new Error('secret-provider-header'), properties)); setup();
    await openAnalyze(user); await user.click(screen.getByRole('button', { name: 'Enviar a OpenAI y analizar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText(/secret-provider-header/)).not.toBeInTheDocument();
    expect(mocks.analyze).toHaveBeenCalledOnce(); expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it('opens the latest history entry by default and confirms before discarding edits to switch entries', async () => {
    const user = userEvent.setup(); const old = { ...analysis, id: 'old', extractedData: { ...analysis.extractedData, merchant: { name: 'Anterior', confidence: 'HIGH' } } };
    mocks.list.mockResolvedValue([analysis, old]); setup(); await openHistory(user);
    expect(screen.getByLabelText('Análisis guardados')).toHaveValue('analysis');
    await user.type(screen.getByLabelText('Comercio'), ' cambiado');
    await user.selectOptions(screen.getByLabelText('Análisis guardados'), 'old');
    expect(screen.getByRole('region', { name: 'Confirmar cambio de revisión' })).toBeVisible();
    expect(screen.getByLabelText('Comercio')).toHaveValue('Mercadona cambiado');
    await user.click(screen.getByRole('button', { name: 'Descartar borrador y revisar' }));
    expect(screen.getByLabelText('Comercio')).toHaveValue('Anterior');
    expect(mocks.confirm).not.toHaveBeenCalled(); expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it('reanalyzes only after consent and does not discard a dirty draft on cancellation or provider failure', async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([analysis]); setup(); await openHistory(user);
    await user.type(screen.getByLabelText('Comercio'), ' corregido');
    await user.click(screen.getByRole('button', { name: 'Volver a analizar' }));
    expect(screen.getByText(/Si el nuevo análisis se completa/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancelar', exact: true }));
    expect(screen.getByLabelText('Comercio')).toHaveValue('Mercadona corregido');
    expect(mocks.analyze).not.toHaveBeenCalled();
    mocks.analyze.mockRejectedValue(new Error('Provider failed'));
    await user.click(screen.getByRole('button', { name: 'Volver a analizar' })); await user.click(screen.getByRole('button', { name: 'Enviar a OpenAI y analizar' }));
    await screen.findByRole('alert'); expect(screen.getByLabelText('Comercio')).toHaveValue('Mercadona corregido');
  });
  it('keeps analysis history when a new analysis completes and replaces the draft only after consent', async () => {
    const user = userEvent.setup(); const next = { ...analysis, id: 'new', extractedData: { ...analysis.extractedData, merchant: { name: 'Nuevo análisis', confidence: 'HIGH' } } };
    mocks.list.mockResolvedValue([analysis]); mocks.analyze.mockImplementation(async () => { mocks.list.mockResolvedValue([next, analysis]); return next; });
    setup(); await openHistory(user); await user.type(screen.getByLabelText('Comercio'), ' editado');
    await user.click(screen.getByRole('button', { name: 'Volver a analizar' })); await user.click(screen.getByRole('button', { name: 'Enviar a OpenAI y analizar' }));
    await waitFor(() => expect(screen.getByLabelText('Comercio')).toHaveValue('Nuevo análisis'));
    expect(within(screen.getByLabelText('Análisis guardados')).getAllByRole('option')).toHaveLength(2);
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it('409 refreshes current versions but requires explicit reopening and another confirmation, never automatic retry', async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([analysis]);
    mocks.confirm.mockImplementationOnce(async () => { mocks.list.mockResolvedValue([{ ...analysis, purchaseVersion: 'version-2' }]); throw Object.assign(new Error('La compra cambió'), { status: 409, code: 'AI_ANALYSIS_STALE' }); });
    setup(); await openHistory(user); await user.type(screen.getByLabelText('Comercio'), ' borrador');
    await user.click(screen.getByRole('button', { name: 'Confirmar datos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La compra ha cambiado');
    expect(screen.getByRole('button', { name: 'Confirmar datos' })).toBeDisabled();
    expect(mocks.confirm).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Revisar con datos actuales' }));
    await user.click(screen.getByRole('button', { name: 'Descartar borrador y revisar' }));
    expect(screen.getByLabelText('Comercio')).toHaveValue('Mercadona');
    expect(mocks.confirm).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Confirmar datos' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(2));
    expect(mocks.confirm.mock.calls[1][0].body.purchaseVersion).toBe('version-2');
  });
  it('never reveals cached review data before fresh authorization and removes it on denied access', async () => {
    const user = userEvent.setup(); const pending = deferred(); mocks.list.mockReturnValue(pending.promise);
    const { client } = setup(); client.setQueryData(queryKeys.purchases.analyses('home', 'purchase', 'document'), [analysis]);
    await user.click(await screen.findByRole('button', { name: 'Ver análisis de ticket.pdf' }));
    expect(screen.getByText('Cargando análisis guardados')).toBeVisible();
    expect(screen.queryByLabelText('Comercio')).not.toBeInTheDocument();
    mocks.documents.mockResolvedValue([]);
    await act(async () => pending.reject(Object.assign(new Error('Forbidden'), { status: 404 })));
    await screen.findByText('No hay documentos guardados.');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(client.getQueryData(queryKeys.purchases.analyses('home', 'purchase', 'document'))).toBeUndefined();
  });
  it('a late analysis response after unmount never repopulates private caches', async () => {
    const user = userEvent.setup(); const pending = deferred(); mocks.analyze.mockReturnValue(pending.promise);
    const { client, unmount, invalidate } = setup(); await openAnalyze(user); await user.click(screen.getByRole('button', { name: 'Enviar a OpenAI y analizar' }));
    unmount(); client.removeQueries(); await act(async () => pending.resolve(analysis));
    expect(client.getQueryData(queryKeys.purchases.analyses('home', 'purchase', 'document'))).toBeUndefined();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.purchases.analyses('home', 'purchase', 'document'), exact: true, refetchType: 'none' });
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it('a late confirmation after changing household never publishes old purchase data or success feedback', async () => {
    const user = userEvent.setup(); const pending = deferred(); mocks.confirm.mockReturnValue(pending.promise); mocks.list.mockResolvedValue([analysis]);
    const { client, refresh, invalidate } = setup(); await openHistory(user); await user.click(screen.getByRole('button', { name: 'Confirmar datos' }));
    refresh({ householdId: 'other' });
    await act(async () => pending.resolve({ analysis: { ...analysis, status: 'CONFIRMED' }, purchase }));
    expect(client.getQueryData(queryKeys.purchases.detail('home', 'purchase'))).toBeUndefined();
    expect(client.getQueryData(queryKeys.purchases.detail('other', 'purchase'))).toBeUndefined();
    expect(screen.queryByText(/Datos confirmados/)).not.toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['budget', 'home'], refetchType: 'none' });
  });
  it('external document removal closes its review, clears analysis cache and restores section focus', async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([analysis]); const { client, onBusyChange } = setup(); await openHistory(user);
    act(() => client.setQueryData(queryKeys.purchases.documents('home', 'purchase'), []));
    await screen.findByText('No hay documentos guardados.');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(client.getQueryData(queryKeys.purchases.analyses('home', 'purchase', 'document'))).toBeUndefined();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Documentos (0)' })).toHaveFocus());
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });
  it('failed and confirmed analyses cannot accidentally be submitted again', async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([{ ...analysis, status: 'FAILED', extractedData: null }]); setup();
    await user.click(await screen.findByRole('button', { name: 'Ver análisis de ticket.pdf' }));
    expect(await screen.findByText(/Este análisis no pudo completarse/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Análisis del documento' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Confirmar datos' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a analizar' })).toBeEnabled();
  });
});
