import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ list: vi.fn(), upload: vi.fn(), update: vi.fn(), remove: vi.fn(), content: vi.fn(), contentUrl: vi.fn() }));
vi.mock('./purchaseDocumentsService', () => ({ purchaseDocumentsService: mocks }));

import { PurchaseDocumentsPanel } from './PurchaseDocumentsPanel';
import { MAX_PURCHASE_DOCUMENT_BYTES, PURCHASE_DOCUMENT_ACCEPT } from './purchaseDocumentSchema';

const purchase = { id: 'purchase', items: [{ id: 'phone', name: 'iPhone 17' }, { id: 'cable', name: 'Cable USB' }] };
const receipt = { id: 'document', filename: 'ticket-apple.pdf', type: 'RECEIPT', contentType: 'application/pdf', sizeBytes: 2048, createdAt: '2026-09-17T12:00:00Z', purchaseItemId: null };
const file = () => new File(['%PDF-1.7 test'], 'ticket.pdf', { type: 'application/pdf' });
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};

function renderPanel(initialProps = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const tree = (props) => <QueryClientProvider client={client}><PurchaseDocumentsPanel householdId="home" purchase={purchase} {...props} /></QueryClientProvider>;
  const result = render(tree(initialProps));
  return { ...result, client, invalidate, refresh: (props = {}) => result.rerender(tree(props)) };
}

async function startUpload(user) {
  await screen.findByText('No hay documentos guardados.');
  await user.click(screen.getByRole('button', { name: 'Añadir documento' }));
  return screen.getByRole('form', { name: 'Añadir documento' });
}

describe('PurchaseDocumentsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([]);
    mocks.upload.mockResolvedValue(receipt);
    mocks.update.mockResolvedValue(receipt);
    mocks.remove.mockResolvedValue({ id: receipt.id, deleted: true });
    mocks.content.mockResolvedValue(new Blob(['test'], { type: 'application/pdf' }));
    mocks.contentUrl.mockImplementation(({ householdId, purchaseId, documentId, disposition }) => `/api/households/${householdId}/purchases/${purchaseId}/documents/${documentId}/content?disposition=${disposition}`);
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:private-document'), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('muestra sección y CTA siempre, carga accesible, vacío exacto y contador', async () => {
    const load = deferred();
    mocks.list.mockReturnValue(load.promise);
    renderPanel();
    expect(screen.getByRole('heading', { name: 'Documentos' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Añadir documento' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando documentos…');
    load.resolve([]);
    expect(await screen.findByText('No hay documentos guardados.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Documentos (0)' })).toBeVisible();
    expect(screen.getByText(/Solo pueden acceder quienes pueden ver esta compra/)).toBeVisible();
    expect(mocks.list.mock.calls[0][0]).toMatchObject({ householdId: 'home', purchaseId: 'purchase', signal: expect.any(AbortSignal) });
  });

  it('lista nombre, tipo amigable, fecha, tamaño y asociación sin exponer metadatos técnicos', async () => {
    mocks.list.mockResolvedValue([receipt, { ...receipt, id: 'warranty', filename: 'garantia.png', type: 'WARRANTY', contentType: 'image/png', purchaseItemId: 'phone' }]);
    renderPanel();
    const list = await screen.findByRole('list', { name: 'Documentos de la compra' });
    expect(list).toHaveTextContent('ticket-apple.pdf');
    expect(list).toHaveTextContent('Ticket · 2 KiB · 17 sept 2026');
    expect(list).toHaveTextContent('Garantía');
    expect(list).toHaveTextContent('Compra completa');
    expect(list).toHaveTextContent('Producto: iPhone 17');
    expect(list).not.toHaveTextContent('RECEIPT');
    expect(screen.getByRole('heading', { name: 'Documentos (2)' })).toBeVisible();
  });

  it('presenta error de listado y reintento sin confundirlo con un vacío', async () => {
    mocks.list.mockRejectedValueOnce(new Error('No hay conexión.')).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión.');
    expect(screen.queryByText('No hay documentos guardados.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir documento' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Volver a intentarlo' }));
    expect(await screen.findByText('No hay documentos guardados.')).toBeVisible();
  });

  it('ofrece archivo único y fotos sin forzar cámara, con labels y foco inicial', async () => {
    const user = userEvent.setup();
    renderPanel();
    const form = await startUpload(user);
    const input = within(form).getByLabelText('Archivo');
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('accept', PURCHASE_DOCUMENT_ACCEPT);
    expect(input).not.toHaveAttribute('capture');
    expect(input).not.toHaveAttribute('multiple');
    expect(input).toHaveAccessibleDescription(/PDF, JPEG, PNG o WebP · máximo 10 MiB/);
    expect(within(form).getByRole('radio', { name: 'Compra completa' })).toBeChecked();
    expect(within(form).getByRole('combobox', { name: 'Tipo' })).toHaveValue('RECEIPT');
    expect(within(form).queryByRole('combobox', { name: 'Producto' })).not.toBeInTheDocument();
  });

  it('sube ticket a compra completa e invalida únicamente sus documentos', async () => {
    const user = userEvent.setup();
    const { invalidate } = renderPanel();
    const form = await startUpload(user);
    const selected = file();
    await user.upload(within(form).getByLabelText('Archivo'), selected);
    mocks.list.mockResolvedValue([receipt]);
    await user.click(within(form).getByRole('button', { name: 'Subir documento' }));
    expect(await screen.findByText('Documento añadido.')).toBeVisible();
    expect(mocks.upload.mock.calls[0][0]).toEqual({ householdId: 'home', purchaseId: 'purchase', file: selected, type: 'RECEIPT', purchaseItemId: null });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate.mock.calls[0][0]).toMatchObject({ queryKey: ['purchases', 'home', 'documents', 'purchase'], exact: true });
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir documento' })).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Documentos (1)' })).toBeVisible();
  });

  it.each([['INVOICE', 'Factura'], ['WARRANTY', 'Garantía'], ['OTHER', 'Otro']])('selecciona tipo %s y producto concreto', async (type, label) => {
    const user = userEvent.setup();
    renderPanel();
    const form = await startUpload(user);
    await user.upload(within(form).getByLabelText('Archivo'), file());
    await user.selectOptions(within(form).getByRole('combobox', { name: 'Tipo' }), label);
    await user.click(within(form).getByRole('radio', { name: 'Producto concreto' }));
    await user.selectOptions(within(form).getByRole('combobox', { name: 'Producto' }), 'phone');
    await user.click(within(form).getByRole('button', { name: 'Subir documento' }));
    await screen.findByText('Documento añadido.');
    expect(mocks.upload.mock.calls[0][0]).toMatchObject({ type, purchaseItemId: 'phone' });
  });

  it('exige archivo y producto válidos con errores asociados y foco', async () => {
    const user = userEvent.setup();
    renderPanel();
    const form = await startUpload(user);
    await user.click(within(form).getByRole('radio', { name: 'Producto concreto' }));
    await user.click(within(form).getByRole('button', { name: 'Subir documento' }));
    expect(within(form).getByLabelText('Archivo')).toHaveFocus();
    expect(within(form).getByLabelText('Archivo')).toHaveAttribute('aria-invalid', 'true');
    expect(within(form).getByRole('combobox', { name: 'Producto' })).toHaveAccessibleDescription('Selecciona un producto de esta compra.');
    await user.upload(within(form).getByLabelText('Archivo'), file());
    await user.click(within(form).getByRole('button', { name: 'Subir documento' }));
    expect(within(form).getByRole('combobox', { name: 'Producto' })).toHaveFocus();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it.each([
    [() => new File(['<svg/>'], 'image.svg', { type: 'image/svg+xml' }), /Solo se admiten archivos/],
    [() => new File([], 'empty.pdf', { type: 'application/pdf' }), /El archivo está vacío/],
    [() => { const selected = file(); Object.defineProperty(selected, 'size', { value: MAX_PURCHASE_DOCUMENT_BYTES + 1 }); return selected; }, /El archivo supera el tamaño máximo permitido/],
  ])('rechaza selección inválida y permite corregirla', async (makeFile, message) => {
    const user = userEvent.setup({ applyAccept: false });
    renderPanel();
    const form = await startUpload(user);
    const input = within(form).getByLabelText('Archivo');
    await user.upload(input, makeFile());
    expect(within(form).getByRole('alert')).toHaveTextContent(message);
    expect(input).toHaveValue('');
    expect(mocks.upload).not.toHaveBeenCalled();
    await user.upload(input, file());
    expect(within(form).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('indica subida, bloquea doble submit y conserva selección cuando falla', async () => {
    const user = userEvent.setup();
    const pending = deferred();
    mocks.upload.mockReturnValue(pending.promise);
    renderPanel();
    const form = await startUpload(user);
    await user.upload(within(form).getByLabelText('Archivo'), file());
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(await within(form).findByRole('button', { name: 'Subiendo documento…' })).toBeDisabled();
    expect(within(form).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(within(form).getByLabelText('Archivo')).toBeDisabled();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    pending.reject(new Error('El archivo no se pudo guardar. Inténtalo de nuevo.'));
    expect(await within(form).findByRole('alert')).toHaveTextContent('El archivo no se pudo guardar');
    expect(within(form).getByLabelText('Archivo').files).toHaveLength(1);
    expect(within(form).getByRole('button', { name: 'Subir documento' })).toBeEnabled();
    expect(screen.queryByText('Documento añadido.')).not.toBeInTheDocument();
  });

  it('cancelar descarta selección y restaura el foco', async () => {
    const user = userEvent.setup();
    renderPanel();
    const form = await startUpload(user);
    await user.upload(within(form).getByLabelText('Archivo'), file());
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Añadir documento' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Añadir documento' }));
    expect(screen.getByLabelText('Archivo').files).toHaveLength(0);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('edita tipo y asociación sin enviar ni reemplazar binario', async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([receipt]);
    renderPanel();
    await user.click(await screen.findByRole('button', { name: `Editar ${receipt.filename}` }));
    const form = screen.getByRole('form', { name: 'Editar documento' });
    expect(within(form).queryByLabelText('Archivo')).not.toBeInTheDocument();
    expect(within(form).getByRole('combobox', { name: 'Tipo' })).toHaveFocus();
    await user.selectOptions(within(form).getByRole('combobox', { name: 'Tipo' }), 'WARRANTY');
    await user.click(within(form).getByRole('radio', { name: 'Producto concreto' }));
    await user.selectOptions(within(form).getByRole('combobox', { name: 'Producto' }), 'cable');
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios del documento' }));
    expect(await screen.findByText('Documento actualizado.')).toBeVisible();
    expect(mocks.update.mock.calls[0][0]).toEqual({ householdId: 'home', purchaseId: 'purchase', documentId: receipt.id, body: { type: 'WARRANTY', purchaseItemId: 'cable' } });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: `Editar ${receipt.filename}` })).toHaveFocus();
  });

  it('permite desvincular un documento del producto y conserva datos ante error de edición', async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([{ ...receipt, purchaseItemId: 'phone', type: 'WARRANTY' }]);
    mocks.update.mockRejectedValue(new Error('No se pudo actualizar.'));
    renderPanel();
    await user.click(await screen.findByRole('button', { name: `Editar ${receipt.filename}` }));
    const form = screen.getByRole('form', { name: 'Editar documento' });
    expect(within(form).getByRole('combobox', { name: 'Producto' })).toHaveValue('phone');
    await user.click(within(form).getByRole('radio', { name: 'Compra completa' }));
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios del documento' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('No se pudo actualizar.');
    expect(mocks.update.mock.calls[0][0].body).toEqual({ type: 'WARRANTY', purchaseItemId: null });
    expect(within(form).getByRole('radio', { name: 'Compra completa' })).toBeChecked();
  });

  it('Ver usa endpoint autenticado en otra pestaña, sin blob, base64 ni HTML incrustado', async () => {
    mocks.list.mockResolvedValue([receipt]);
    renderPanel();
    const link = await screen.findByRole('link', { name: `Ver ${receipt.filename} (abre otra pestaña)` });
    expect(link).toHaveAttribute('href', '/api/households/home/purchases/purchase/documents/document/content?disposition=inline');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(mocks.content).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(window.document.querySelector('iframe, object, embed')).not.toBeInTheDocument();
  });

  it('descarga blob privado y limpia enlace y URL temporal al salir', async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([receipt]);
    const { unmount } = renderPanel();
    await user.click(await screen.findByRole('button', { name: `Descargar ${receipt.filename}` }));
    expect(await screen.findByText(/Descarga iniciada/)).toBeVisible();
    expect(mocks.content.mock.calls[0][0]).toEqual({ householdId: 'home', purchaseId: 'purchase', documentId: receipt.id });
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    const clicked = HTMLAnchorElement.prototype.click.mock.instances[0];
    expect(clicked.download).toBe(receipt.filename);
    expect(clicked.href).toBe('blob:private-document');
    expect(clicked).not.toBeInTheDocument();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-document');
  });

  it('explica fallo de descarga y permite reintentar sin fingir éxito', async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([receipt]);
    mocks.content.mockRejectedValue(new Error('Documento no disponible.'));
    renderPanel();
    await user.click(await screen.findByRole('button', { name: `Descargar ${receipt.filename}` }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Documento no disponible.');
    expect(screen.queryByText(/Descarga iniciada/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Descargar ${receipt.filename}` })).toBeEnabled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('revoca la URL temporal tras su plazo aunque siga en la ficha', async () => {
    const user = userEvent.setup();
    const timers = vi.spyOn(window, 'setTimeout');
    mocks.list.mockResolvedValue([receipt]);
    const { unmount } = renderPanel();
    await user.click(await screen.findByRole('button', { name: `Descargar ${receipt.filename}` }));
    await screen.findByText(/Descarga iniciada/);
    const revoke = timers.mock.calls.find(([, delay]) => delay === 60_000)?.[0];
    expect(revoke).toEqual(expect.any(Function));
    revoke();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('limpia URL y enlace si el navegador no permite iniciar la descarga', async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([receipt]);
    HTMLAnchorElement.prototype.click.mockImplementation(() => { throw new Error('No se pudo iniciar la descarga.'); });
    renderPanel();
    await user.click(await screen.findByRole('button', { name: `Descargar ${receipt.filename}` }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo iniciar la descarga.');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-document');
    expect(document.querySelector('a[download]')).not.toBeInTheDocument();
  });

  it('bloquea descargas duplicadas y muestra estado mientras llega el archivo', async () => {
    const user = userEvent.setup();
    const pending = deferred();
    mocks.content.mockReturnValue(pending.promise);
    mocks.list.mockResolvedValue([receipt]);
    const { unmount } = renderPanel();
    const trigger = await screen.findByRole('button', { name: `Descargar ${receipt.filename}` });
    await user.dblClick(trigger);
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent('Descargando…');
    expect(mocks.content).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => { pending.resolve(new Blob(['test'])); await pending.promise; });
  });

  it('confirma eliminación, enfoca Cancelar y permite Escape con restauración de foco', async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([receipt]);
    renderPanel();
    const trigger = await screen.findByRole('button', { name: `Eliminar ${receipt.filename}` });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '¿Eliminar documento?' });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(dialog).toHaveTextContent('de forma definitiva');
    expect(mocks.remove).not.toHaveBeenCalled();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: 'Eliminar documento' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('elimina tras confirmación y devuelve foco al encabezado si desaparece el documento', async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([receipt]);
    const { invalidate } = renderPanel();
    await user.click(await screen.findByRole('button', { name: `Eliminar ${receipt.filename}` }));
    mocks.list.mockResolvedValue([]);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar documento' }));
    expect(await screen.findByText('Documento eliminado.')).toBeVisible();
    expect(mocks.remove.mock.calls[0][0]).toEqual({ householdId: 'home', purchaseId: 'purchase', documentId: receipt.id });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(receipt.filename)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Documentos (0)' })).toHaveFocus();
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('mantiene confirmación y documento si falla el borrado', async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([receipt]);
    mocks.remove.mockRejectedValue(new Error('No se pudo eliminar el archivo.'));
    renderPanel();
    await user.click(await screen.findByRole('button', { name: `Eliminar ${receipt.filename}` }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar documento' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se pudo eliminar el archivo.');
    expect(screen.getByRole('heading', { name: receipt.filename })).toBeVisible();
    expect(screen.queryByText('Documento eliminado.')).not.toBeInTheDocument();
  });

  it('descarta formulario y archivos al cambiar de hogar; una subida tardía no anuncia éxito', async () => {
    const user = userEvent.setup();
    const pending = deferred();
    mocks.upload.mockReturnValue(pending.promise);
    const { refresh, invalidate } = renderPanel();
    const form = await startUpload(user);
    await user.upload(within(form).getByLabelText('Archivo'), file());
    await user.click(within(form).getByRole('button', { name: 'Subir documento' }));
    refresh({ householdId: 'other' });
    await screen.findByText('No hay documentos guardados.');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    pending.resolve(receipt);
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    expect(invalidate.mock.calls[0][0]).toMatchObject({ refetchType: 'none', queryKey: ['purchases', 'home', 'documents', 'purchase'] });
    expect(screen.queryByText('Documento añadido.')).not.toBeInTheDocument();
  });

  it('no descarga ni crea URL si el contenido llega después de salir', async () => {
    const user = userEvent.setup();
    const pending = deferred();
    mocks.content.mockReturnValue(pending.promise);
    mocks.list.mockResolvedValue([receipt]);
    const { unmount } = renderPanel();
    await user.click(await screen.findByRole('button', { name: `Descargar ${receipt.filename}` }));
    unmount();
    await act(async () => { pending.resolve(new Blob(['test'])); await pending.promise; });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it('oculta documentos cacheados tras perder permisos y no confunde el error con lista vacía', async () => {
    mocks.list.mockResolvedValue([receipt]);
    const { client } = renderPanel();
    await screen.findByRole('heading', { name: receipt.filename });
    mocks.list.mockRejectedValue(Object.assign(new Error('No encontrado.'), { status: 404 }));
    await act(async () => { await client.invalidateQueries(); });
    expect(await screen.findByRole('alert')).toHaveTextContent('No encontrado.');
    expect(screen.queryByText(receipt.filename)).not.toBeInTheDocument();
    expect(screen.queryByText('No hay documentos guardados.')).not.toBeInTheDocument();
  });

  it.each(['Editar', 'Eliminar'])('oculta también %s y el nombre retenido ante pérdida de acceso', async (action) => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([receipt]);
    const { client } = renderPanel();
    await user.click(await screen.findByRole('button', { name: `${action} ${receipt.filename}` }));
    mocks.list.mockRejectedValue(Object.assign(new Error('Acceso no disponible.'), { status: 403 }));
    await act(async () => { await client.invalidateQueries(); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso no disponible.');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(receipt.filename)).not.toBeInTheDocument();
  });

  it('mantiene clases responsive, targets de 44 px y ajuste de nombres largos sin truncarlos', async () => {
    const filename = `${'ticket'.repeat(50)}.pdf`;
    mocks.list.mockResolvedValue([{ ...receipt, filename }]);
    const { container } = renderPanel();
    const heading = await screen.findByRole('heading', { name: filename });
    expect(heading).toHaveClass('[overflow-wrap:anywhere]');
    expect(heading).not.toHaveClass('truncate');
    for (const target of container.querySelectorAll('button, a')) {
      expect(target.className).toMatch(/min-h-1[12]/);
    }
    const actions = screen.getByRole('button', { name: `Descargar ${filename}` }).parentElement;
    expect(actions).toHaveClass('grid-cols-2', 'min-w-0', 'sm:flex-wrap');
  });
});
