# Fase 6.5 — Análisis de tickets y facturas con IA

## Flujo y decisiones

En Compras → detalle → Documentos, cada PDF/JPEG/PNG/WebP ofrece «Analizar con IA» y «Ver análisis guardados». Antes de cada envío se explica que se remitirá una copia a OpenAI y que puede tener coste. Cancelar ese paso no envía el archivo. Durante la llamada aparece «Analizando documento…»; no se impide navegar por la aplicación.

El resultado abre «Revisar datos detectados», con el aviso «Comprueba la información antes de guardarla. La IA puede cometer errores.». La extracción se conserva como borrador privado; **no modifica la compra**. Comercio, fecha, total y productos son editables. Los datos no detectados siguen identificados como tales; si se propone conservar un valor actual de la compra, se explica su procedencia. LOW/MEDIUM muestran «Revisar», sin porcentajes que aparenten precisión matemática.

La persona elige qué campos aplicar. Añadir los productos a la compra exige activar una casilla explícita: se añaden como nuevos, sin borrar ni reemplazar los existentes, sus garantías, seriales ni vínculos a documentos. Se advierte de posibles duplicados. Marca, modelo y precio unitario son datos secundarios desplegables; el total de cada línea y su cantidad están visibles.

Si la suma no coincide, se presenta una advertencia y una aceptación explícita; corregir de nuevo los importes reinicia esa aceptación. No se convierte moneda automáticamente. Las cuotas PAID protegen el total; modificar una fecha sigue las mismas reglas de garantías por duración que la edición normal. El precio no equivale al dinero pagado y este flujo no registra pagos, cambia propiedad ni decide financiación.

«Confirmar datos» envía los valores revisados, campos seleccionados y versión de la compra. Un cambio concurrente exige volver a revisar los datos actuales, sin gastar otro análisis ni reintentar el guardado automáticamente. Se puede reanalizar y seleccionar intentos anteriores; los originales extraídos permanecen inmutables. Cancelar la revisión descarta solo el borrador local, no el documento ni su historial. Un análisis confirmado no vuelve a añadir productos.

## Auditoría UX/UI

| Zona | Resultado | Comprobación |
| --- | --- | --- |
| Acción principal | ✅ Correcto | Envío con consentimiento; después «Confirmar datos», separado de cancelar y reanalizar. |
| Privacidad | ✅ Correcto | Copia a OpenAI explicada antes de enviar, documento original privado, sin claves ni SDK en React. |
| Formulario | ✅ Correcto | Labels persistentes, cantidades/importes con teclado adecuado, fecha nativa y valores editables. |
| Incertidumbre | ✅ Correcto | «Revisar», advertencias, null desconocido, origen de valores actuales explicado. |
| Productos | ✅ Correcto | Añadir/editar/eliminar del borrador, sin destruir productos ni garantías existentes; máximo 50 en la compra. |
| Finanzas | ✅ Correcto | Distinción precio/pago, total protegido con cuotas PAID y validación del dominio en servidor. |
| Carga y errores | ✅ Correcto | Estado anunciable, timeout acotado, mensajes seguros, falta de clave comprensible y borrador conservado ante fallos recuperables. |
| Historial | ✅ Correcto | Más reciente por defecto, estados Sin confirmar/Confirmado/No completado y confirmación antes de descartar un borrador para cambiar de análisis. |
| Concurrencia | ✅ Correcto | Bloqueo de doble envío, versión de compra y revisión explícita tras 409; sin retry automático de una operación de pago. |
| Foco y teclado | ✅ Correcto | Foco inicial en revisión, errores enfocados, cancelación del consentimiento por defecto y retorno a la acción al cerrar. |
| Targets táctiles | ✅ Correcto | Controles visibles de al menos 44 px; checkbox asociado a label amplio y ayuda mediante aria-describedby. |
| Responsive y fechas | ✅ Correcto | 72 combinaciones Chromium a 320, 375, 768 y 1280 px; sin desbordamiento horizontal ni controles de menos de 44 px. |
| Contenido largo | ✅ Correcto | Comercio/productos/marca/número de documento/advertencias largos, sin salida del marco. |
| Safari físico / lector de pantalla | ⚠️ Mejorable | No se ha probado en un iPhone físico ni con lector de pantalla; las pruebas DOM y Chromium no los sustituyen. |

## Verificación

- Base anterior verde antes de modificar: 737 pruebas backend y 619 frontend.
- Resultado final: 876 pruebas backend (53 archivos) y 673 frontend (63 archivos), todas correctas. Se habilitaron las integraciones PostgreSQL de todas las fases, incluido `PURCHASE_ANALYSIS_DB_TEST=1`. Prisma validate, lint de ambos repositorios, build de producción del cliente y diff-check correctos.
- Dos pruebas PostgreSQL con transacciones realmente concurrentes: dos confirmaciones simultáneas producen 200/409, un único conjunto de productos añadidos y una única auditoría; un PATCH que se confirma durante la revisión provoca `AI_ANALYSIS_STALE`. La entrada pagada, cuota PAID y snapshots de reparto permanecen idénticos. Las fixtures comprometidas para esta prueba se eliminan por sus UUID exactos al terminar.
- QA en navegador con componentes reales y servicios simulados: revisión normal, edición de comercio/fecha/total/producto, diferencia de importes aceptada conscientemente, fecha ausente, extracción borrosa, productos vacíos, texto largo, financiación protegida, error, carga y cancelación. Panel completo: consentimiento, cancelación previa al envío, preview, confirmación, reanálisis con historial, carga y error de configuración.
- Caso Mercadona: fecha 17/09/2026, Producto A 5,50 €, Producto B 3,20 €, total 8,70 €. Antes de confirmar no hay escritura; las correcciones se transportan en céntimos y fecha civil, no se sustituyen por la extracción original.
- Captura móvil de 375 px inspeccionada: fecha y formularios quedan dentro de su contenedor. Se usa iframe de ancho fijo porque Chrome en macOS impone un mínimo a la ventana principal.
- JPEG/PNG/WebP/PDF, falta de IVA/fecha, imagen borrosa, errores OpenAI, usage y salida estricta se prueban con proveedor/fetch simulados en backend. Las pruebas de base de datos usan fixtures aisladas y rollback o limpieza exacta.
- No se ha enviado ningún documento real ni realizado llamadas facturables a OpenAI. `OPENAI_API_KEY` no está configurada en este entorno; la extracción real queda pendiente de configurarla y reiniciar la API. No se afirma una precisión OCR medida con fotografías reales.
- Migración aditiva aplicada y cliente Prisma generado localmente. Web `/login` comprobada con HTTP 200 y `/api/health` devuelve BudgetApp en desarrollo, estado `ok`, mediante `192.168.1.99:5173`.

## Límites deliberados

No hay OCR local alternativo, fallback a modelos más caros, File Search, Vector Stores, URLs documentales públicas, Telegram ni fases posteriores. No se infieren garantía, forma de pago, reparto ni datos ausentes. `store:false` no equivale por sí mismo a retención cero del proveedor. El control de coste en memoria del proceso sigue activo en desarrollo; múltiples procesos requerirían compartir ese contador.

Se reutilizan estilos, tokens, componentes de feedback y campos existentes. No se rediseñan otras pantallas ni se relajan protecciones financieras para facilitar la importación.
