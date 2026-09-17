# Fase 6.2 — Documentos privados de compras

## Alcance

Dentro de la ficha de una compra se pueden subir, listar, ver, descargar, editar los metadatos y eliminar documentos. Tipos visibles: Ticket, Factura, Garantía y Otro. Un documento se asocia a la compra completa o a un producto de esa misma compra.

No se añade IA, OCR, extracción de contenido, financiación, cuotas, Telegram ni integración financiera. Adjuntar una factura a una compra no crea una UtilityInvoice ni modifica presupuestos, cuentas o aportaciones. Tampoco cambia automáticamente la fecha de garantía: el documento y los datos de garantía son información independiente.

## Arquitectura y seguridad

- Nuevos modelos `PurchaseDocument` y `PurchaseDocumentContent`, enum `PurchaseDocumentType` y tres acciones de auditoría. El binario vive en una tabla privada separada de la metadata; no aparece en el JSON de compra ni en los listados.
- Se reutiliza PostgreSQL/Bytes, como el sistema existente de InvoiceDocument, detrás de un adaptador `save/get/delete`. No se añaden servicios externos. Sustituir el proveedor requerirá migrar almacenamiento y conservar atomicidad mediante staging/compensación, pero no reescribir permisos y rutas de metadatos.
- PDF, JPEG, PNG y WebP, máximo 10 MiB por documento. Política centralizada por runtime y compartida con documentos de facturas. Validación de MIME, firmas/estructura existente, tamaño y nombre; no se confía en la extensión del navegador. No se implementa un parser nuevo ni se afirma un análisis antivirus.
- Nombres sin rutas ni controles, limitados y con extensión segura según MIME. El nombre nunca identifica una ruta de almacenamiento. Se conservan cabeceras de descarga con nombre UTF-8 seguro, tipo y longitud.
- Todos los endpoints requieren sesión y visibilidad actual de la compra. Se repiten las comprobaciones en las transacciones; no hay excepción para OWNER ni acceso permanente por ser quien subió el archivo. Datos privados sin caché HTTP, `nosniff` y política CSP restrictiva para contenido.
- La subida es un cuerpo binario, no base64 ni multipart personalizado. Metadata de creación en query y nombre codificado en `X-Document-Filename`; editar usa JSON con solo tipo/asociación. El parser de subida se ejecuta después de autenticar y autorizar, con el límite de tamaño y sin compresión de transporte.
- Metadata, binario y auditoría se guardan/eliminan atómicamente. Fallos de storage producen error 503 accionable y rollback; no se muestra éxito ni quedan archivos huérfanos. Las restricciones SQL también comprueban existencia/tamaño del binario y producto de la misma compra.

## Decisiones de interacción

- Sección Documentos visible en detalle con contador, estado vacío «No hay documentos guardados.» y acción principal «Añadir documento».
- Formulario de un archivo: selector normal con formatos admitidos, tipo, radios Compra completa/Producto concreto y selector de producto solo cuando corresponde. No se obliga a usar la cámara ni se utiliza `capture`; el selector del dispositivo puede ofrecer fotos/cámara según soporte del navegador y formatos.
- Listado con icono, nombre completo ajustable, tipo, tamaño, fecha y asociación. Ver abre una pestaña hacia el endpoint privado autenticado; no genera enlaces públicos ni inserta HTML o PDF activo en el DOM del cliente. Descargar obtiene Blob por el cliente HTTP con manejo de sesión/errores y revoca URLs temporales al salir o tras 60 segundos.
- Editar cambia únicamente tipo/asociación; no reemplaza el archivo. Eliminar exige confirmación explícita y borra documento y binario para todas las personas con acceso a la compra, sin borrar compra/productos.
- Eliminar un producto conserva sus documentos, ahora asociados a Compra completa. La confirmación de borrado lo explica y se actualiza la consulta de documentos.
- Archivar una compra conserva también los documentos, pero los hace inaccesibles como el resto de la compra. La confirmación lo explica expresamente. No se añade vista de archivadas/restauración en esta fase.
- Query keys aisladas por hogar y compra. Subir/editar/borrar documento refresca solo su listado; no hay `documentCount` persistido/en el detalle que requiera invalidación adicional. Los cambios de producto actualizan también documentos, y el archivado/pérdida de acceso cancela y elimina caché del detalle y de sus documentos. No se invalida el dominio financiero ni se recarga la ventana.

## Auditoría UX/UI

| Zona | Resultado | Reglas / comprobación |
| --- | --- | --- |
| Jerarquía y acciones | ✅ Correcto | 1, 19–24: Añadir documento es primaria; acciones secundarias con texto y eliminación diferenciada |
| Formulario | ✅ Correcto | 26–35, 47: labels persistentes, dos radios para asociación, producto condicional, ayuda de formatos/tamaño y errores asociados |
| Carga y errores | ✅ Correcto | 32, 44, 48: consulta, envío y descarga visibles; doble envío bloqueado; error conserva selección/metadatos para reintentar |
| Privacidad en UI | ✅ Correcto | 42, 48: cambio de hogar/compra reinicia panel; errores 401/403/404 ocultan listado, edición y confirmación antiguos |
| Teclado/foco | ✅ Correcto | 18, 24, 26: foco inicial en formulario, error enfocado, retorno al disparador y diálogo con Tab/Escape |
| Nombres largos | ✅ Correcto | 7, 8, 48: filename de 255 caracteres y producto largo sin truncar información ni desbordar |
| Móvil | ✅ Correcto | 3, 24, 48: acciones en dos columnas, controles táctiles visibles de al menos 44 px y archivo limitado al ancho del formulario |

## Verificación

### Funcional

- Servidor: **578 tests / 41 archivos**, incluidos 57 nuevos unitarios/HTTP, 18 integraciones de documentos PostgreSQL con rollback y siete pruebas nuevas de montaje/auth/CSRF. Las integraciones fuerzan comprobación de restricciones diferidas, y prueban fallos de storage/auditoría, privacidad, conservación al borrar producto y ausencia de impacto financiero.
- Cliente: **462 tests / 53 archivos**. 54 nuevos (31 UI y 23 de selección/servicio), más ampliaciones de integración en ficha y de aislamiento de caché. Se conserva la suite de InvoiceDocument tras extraer helpers compartidos.
- Ambos `npm run lint`, `git diff --check`, `npm run build` del cliente, `prisma:validate` y `prisma:generate`: correctos.
- Migración aditiva `20260917223000_add_purchase_documents` aplicada al PostgreSQL local. `prisma migrate status`: nueve migraciones, esquema actualizado. Sin backfill ni modificación de compras/datos financieros existentes.
- Node 20.18.3. Flags de integración: `BUDGET_MARGIN_DB_TEST=1 CUSTOM_WEEKS_DB_TEST=1 CALENDAR_PAYMENTS_DB_TEST=1 MONTHLY_PROGRESS_DB_TEST=1 PURCHASES_DB_TEST=1 PURCHASE_DOCUMENTS_DB_TEST=1`.

### Responsive

Chrome con perfil temporal y fixtures ficticias, componentes reales y CSS de producción. 40 combinaciones: vacío, listado, subida, asociación a producto, edición, error, validación, confirmación de borrado, nombres largos y flujo subir→editar→eliminar; anchos efectivos 320, 375, 768 y 1280 px.

Sin desbordamiento de página/contenido ni controles visibles menores de 44 px. El flujo completo conserva File binario, tipo Garantía y producto; luego cambia a Otro/Compra completa y elimina, en los cuatro tamaños. La API de esta prueba visual es simulada; las pruebas HTTP/PostgreSQL verifican el backend por separado sin guardar fixtures permanentes en hogares reales.

Se ha inspeccionado visualmente una captura del formulario/asociación a producto y su listado a 375 px efectivos. La API de desarrollo responde `ok` a través de `192.168.1.99:5173/api/health` tras la integración.

### Visor nativo de documentos

Prueba adicional con servidor HTTP efímero y archivos ficticios válidos: Chrome visualiza un PDF con `Content-Disposition: inline` y la CSP exacta `sandbox; default-src 'none'`. También visualiza un PNG de 1600 × 800 y lo ajusta a 375 px sin desbordamiento. La política restrictiva bloquea estilos de centrado del visor de imágenes y puede generar avisos CSS, pero conserva visualización y escalado; no se relajó la CSP para un cambio puramente estético. Se cerraron el servidor efímero y las instancias de navegador de pruebas sin alterar los procesos de BudgetApp.

Limitación: Chromium no sustituye una prueba con Safari/iPhone físico, su selector de cámara/fotos o VoiceOver.
