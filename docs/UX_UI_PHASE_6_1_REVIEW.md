# Fase 6.1 — Compras, productos y garantías

## Alcance y arquitectura

Registro independiente del dominio financiero. Backend en `src/modules/purchases/`; frontend en `src/features/purchases/`, `PurchasesPage` y `PurchaseDetailsPage`. No genera gastos puntuales, recurrentes, facturas, movimientos, ajustes de presupuesto ni cambios de saldo. Tampoco añade documentos, subida de archivos, OCR, IA, financiación, cuotas, Telegram ni notificaciones de garantía.

Se mantienen las fases anteriores y sus componentes compartidos, incluidos el formulario de pagos, márgenes, CUSTOM_WEEKS, progreso mensual y la corrección de controles de fecha móviles.

## Decisiones del dominio

- Modelos `Purchase`, `PurchaseShare` y `PurchaseItem`. Una compra tiene al menos un producto; su importe total es independiente de la suma de precios de los productos.
- Propiedad del hogar: persona null y sin shares. Personal: una persona del hogar y sin shares. Repartida: persona null y al menos dos participantes distintos, porcentajes positivos en puntos básicos y suma exacta de 10.000.
- Creación, cambios de propiedad y operaciones de producto son transaccionales. La normalización elimina relaciones incompatibles. No se puede eliminar el último producto; se puede archivar la compra completa, conservando todos sus productos.
- Privacidad en backend: miembros ven compras del hogar, personales propias y repartidas donde participan. OWNER/ADMIN no tienen una excepción para los registros privados. Una compra invisible no se puede leer ni modificar.
- Al asignar a otra persona o dejar de participar, el autor puede perder acceso: la escritura devuelve solo `id` y `accessRevoked`, la UI sale del detalle y limpia su caché. Los formularios avisan de la visibilidad antes de guardar.
- Editar metadatos conserva titulares o participantes históricos inactivos si la propiedad no cambia semánticamente; también conserva los identificadores de sus shares. El formulario identifica estas opciones como «inactiva» únicamente en el tipo original. Una asignación nueva exige personas activas del hogar.
- PATCH de compra edita sus metadatos/propiedad; los productos tienen endpoints propios. Los registros de auditoría distinguen compra creada/modificada/archivada y producto creado/modificado/eliminado.
- Serie e IMEI son opcionales, limitados y normalizados, sin imponer un formato universal. Se muestran en detalle y se omiten del listado de API y de las tarjetas.

## Garantía

Cada producto conserva fecha final y procedencia: `DURATION` o `EXPLICIT_DATE`, o campos null cuando no hay garantía registrada. La duración en meses se guarda solo para DURATION. La fecha explícita de entrada tiene prioridad si llegan ambos valores.

Los años se convierten a meses; el cálculo usa meses de calendario, ajustando al último día válido del mes destino. 31/01 + 1 mes = 28/02 (29/02 en bisiesto). Cambiar la fecha de compra recalcula exclusivamente DURATION; EXPLICIT_DATE permanece intacta. No se infiere ninguna duración legal.

El backend deriva el estado con la fecha civil actual de la zona horaria del hogar. Más de 60 días: vigente; de 0 a 60: próxima a caducar; días negativos: caducada; sin fecha: sin garantía y días null. El día final se anuncia como «Caduca hoy». El umbral vive en una sola constante del backend, no en componentes React.

El preview de formulario es orientativo; el servidor valida y calcula el resultado definitivo. Cambiar solo otros datos de un producto no elimina su garantía.

## Navegación, listado y edición

- Acceso `Más → Compras`, manteniendo cinco destinos en la barra móvil. Listado `/compras`; detalle `/compras/:purchaseId`. «Más» continúa activo en la ficha y el título del documento es «Compras».
- Búsqueda siempre visible por producto, marca, modelo o tienda. Filtros de propiedad y garantía detrás de «Filtrar», con contador, limpieza y retorno de foco con Escape.
- Orden de compras más recientes primero. Una tarjeta muestra producto principal, tienda, fecha, importe, propiedad y garantía. Si hay varios productos, muestra cantidad y resumen por estados, sin atribuir una sola garantía a toda la compra.
- El filtro de garantía coincide si al menos un producto cumple el estado. «Vigente» incluye las próximas a caducar; este segundo filtro permite aislarlas.
- Formulario por bloques: compra, propiedad y productos. Parte de un producto; añadir/quitar mueve el foco al campo correspondiente. Porcentajes muestran total y cuánto falta o sobra; reparto inválido no se guarda.
- Serie, IMEI, cantidad y notas de producto quedan en un desplegable secundario. La garantía tiene un control explícito y métodos duración o fecha fin.
- Archivado y borrado de producto requieren confirmación, con foco inicial en Cancelar, Escape y navegación de teclado contenida en el diálogo.
- React Query mantiene claves propias por hogar y compra. Las mutaciones refrescan lista/detalle afectados, nunca invalidan caches financieras ni recargan la ventana.

## Auditoría UX/UI

| Zona | Resultado | Reglas y decisiones |
| --- | --- | --- |
| Navegación | ✅ Correcto | Reglas 41–43: usa Más y el layout existente, sin sexta pestaña móvil |
| Listado | ✅ Correcto | Reglas 2, 6, 19: tarjetas escaneables, nombres e importes legibles; datos técnicos reservados al detalle |
| Búsqueda y filtros | ✅ Correcto | Reglas 35, 47: búsqueda visible, filtros secundarios plegados, contador y recuperación del vacío filtrado |
| Propiedad | ✅ Correcto | Reglas 26, 33, 47: fieldset y radios con nombres comprensibles, avisos de privacidad y reparto verificable |
| Productos | ✅ Correcto | Reglas 28, 48: uno inicial, campos avanzados secundarios y foco correcto al añadir/quitar |
| Garantía | ✅ Correcto | Reglas 14, 30–32: control explícito, preview por calendario, fechas y días en texto; no solo color |
| Errores | ✅ Correcto | Reglas 26, 32: labels persistentes, aria-invalid/describedby, foco en campo incorrecto incluso dentro de details |
| Acciones destructivas | ✅ Correcto | Reglas 20–24: etiquetas explícitas, confirmación y bloqueo del último producto |
| Responsive | ✅ Correcto | Reglas 3, 48: min-width controlado, datos largos envolventes y campos de fecha dentro de sus tarjetas |
| Estados | ✅ Correcto | Carga, error/reintento, sin hogar, sin compras, búsqueda vacía y detalle no accesible diferenciados |

## Verificación visual y ejemplo solicitado

Chrome headless con perfil temporal y fixtures ficticias: componentes reales, CSS de producción y layout equivalente al contenido/anchos de la aplicación. 28 combinaciones: listado, detalle, formulario nuevo, reparto 60/40, edición de garantía, textos/importes largos y creación del iPhone. Anchos efectivos de iframe: 320, 375, 768 y 1280 px. Ningún desbordamiento de página o tarjetas; targets interactivos visibles de al menos 44 px, incluidos labels de radios/checkboxes y campos de fecha.

El flujo de creación se ejecutó en navegador en los cuatro tamaños: Apple Store, 17/09/2026, total 999 €, personal de Pablo, iPhone 17/Apple/17, serie ABC123, IMEI 123456789012345 y 3 años. El payload conserva 99.900 céntimos y 36 meses; el cálculo de servidor produce 17/09/2029 y el detalle muestra los identificadores y propiedad correctos. La comprobación visual usa API simulada; las pruebas HTTP/PostgreSQL verifican por separado persistencia, permisos, edición y ausencia de impacto financiero con rollback de datos ficticios.

También se presentan televisión del hogar y compra repartida Pablo 60 % / Natalia 40 %, incluyendo diferentes estados de garantía por producto. Se inspeccionó visualmente la captura móvil del detalle.

Limitaciones de QA: Chromium no sustituye una prueba en Safari/iPhone físico ni un estudio de usabilidad con personas. No se han creado compras ficticias permanentes en el hogar del usuario.

## Migración y comprobaciones

Migración aditiva `20260917210000_add_purchases`: tres tablas, enums de propiedad/procedencia y acciones de auditoría; índices, unicidad de participante, checks de dinero/cantidad/garantía y triggers diferidos para propiedad, pertenencia al hogar y mínimo un producto. No requiere backfill ni modifica importes financieros. Prisma Client regenerado y migración aplicada al PostgreSQL local.

Las pruebas cubren schemas, normalización, calendario, privacidad, API/CSRF, atomicidad, archivado, integridad SQL y separación respecto a finanzas; en cliente, formularios, búsqueda/filtros, garantías, edición, foco/teclado e invalidación de caché.

Resultado final de las suites completas:

| Comprobación | Resultado |
| --- | --- |
| Servidor: `npm test` con los cinco flags de integración PostgreSQL | 496 tests, 39 archivos, todos correctos |
| Cliente: `npm test` | 408 tests, 50 archivos, todos correctos |
| Nuevos tests de esta fase | 83 servidor (62 unitarios, 14 HTTP/PostgreSQL, 7 montaje/auth/CSRF) y 110 cliente |
| `npm run lint`, ambos repositorios | Correcto |
| `npm run build`, cliente | Correcto |
| `npm run prisma:validate` y `npm run prisma:generate` | Correcto |
| `prisma migrate status` | Ocho migraciones aplicadas; esquema local actualizado |
| `git diff --check`, ambos repositorios | Correcto |

Flags de servidor utilizados: `BUDGET_MARGIN_DB_TEST=1`, `CUSTOM_WEEKS_DB_TEST=1`, `CALENDAR_PAYMENTS_DB_TEST=1`, `MONTHLY_PROGRESS_DB_TEST=1` y `PURCHASES_DB_TEST=1`. Comandos ejecutados con Node 20.18.3. Los fixtures de integración se revierten mediante rollback.

No hay restauración de compras archivadas en esta fase. Las búsquedas/filtros son locales sobre el listado ya autorizado del hogar, siguiendo el patrón actual de gastos; una paginación de alto volumen se podrá abordar posteriormente sin cambiar el dominio.
