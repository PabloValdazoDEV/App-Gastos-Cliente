# Fase 4 — Calendario interactivo

## Alcance y decisiones

- Calendario y Gastos recurrentes comparten `features/finance/PaymentOccurrenceForm.jsx` para crear y corregir pagos. `paymentOccurrence.js` concentra schema, valores iniciales, payload, conflictos e invalidación. Se eliminan los formularios independientes anteriores; no se crea ningún endpoint nuevo.
- El calendario solo ofrece acciones según `canRegisterPayment`/`canEditPayment` calculados por la API. No solicita el gasto para comparar fechas ni reconstruye recurrencias. Proyecciones posteriores siguen visibles sin botones deshabilitados; una explicación general evita repetir ruido en cada tarjeta.
- Se permite pagar por adelantado o registrar un atrasado: vencimiento y fecha real son independientes. Omitir abre un panel con notas y requiere pulsar `Confirmar omisión`; no guarda al abrirlo. Los registros históricos nunca muestran la opción de cambiar importes futuros.
- Un solo formulario contextual abierto, cancelación sin guardar, autofocus y retorno del foco. Respuestas tardías no cierran otro formulario; si un refresco externo retira la acción o la tarjeta, se cierra el borrador obsoleto y se recupera el foco.
- Se invalidan calendario, recurrentes, pagos y todos los prefijos financieros existentes (dashboard, presupuesto, planificación/simulación). Se hace también sin cambio de importe, pues avanzar una fecha puede cambiar el horizonte de reservas. No se usa `window.location.reload()`.
- Se mantienen filtros, márgenes, `CUSTOM_WEEKS`/`intervalWeeks` y CSS de fechas para Safari. No se añaden pagos para puntuales, facturas o variables, ni funcionalidades de fases posteriores. No hay migración ni cambio de Prisma en esta fase.

## Auditoría UX/UI

- ✅ Reglas 1–8, 19–23 y 40–43: tarjetas con fecha, nombre, ámbito, categoría, importe y estado textual; una acción primaria para el pendiente y edición secundaria del histórico. Rangos envueltos en móvil, sin desplazamiento horizontal obligatorio.
- ✅ Reglas 14, 18, 24–27 y 30–34: labels persistentes, estado además de color, nombres accesibles, `aria-expanded`/`aria-controls`, controles nativos, botones de al menos 44px y radios con etiqueta táctil. Se conserva el indicador del selector de fecha.
- ✅ Reglas 32, 44 y 48: carga, vacío, error recuperable, envío pendiente y campos con error asociado; confirmación explícita de omisión y toasts diferenciados. Conflictos por registro duplicado/fuera de orden refrescan datos y cierran el formulario obsoleto.
- ✅ Reglas 42, 46 y 49: un solo formulario/schema/payload para las dos pantallas y los dos modos. Reutiliza componentes, tokens y reglas financieras previas.
- ✅ Responsive: componentes reales compilados y CSS de producción en Chrome headless, dentro de viewports de 320, 375, 768 y 1280px; se reproduce el espacio de barra lateral del layout. 20 combinaciones (cerrado, crear pagado, omitir, editar pagado y editar omitido) sin desbordamiento horizontal, con textos largos sin separadores, fecha limitada a su contenedor y botones >=44px. Captura a 375px revisada visualmente.
- ✅ Teclado/foco: pruebas DOM de apertura, recorrido por controles, cancelación, errores, retorno al disparador y refresco externo; una respuesta de otra tarjeta no roba el formulario activo.
- ⚠️ No se dispone de un iPhone conectado: la medición en Chromium no sustituye la comprobación del selector nativo ni VoiceOver en Safari/iOS real. El arreglo específico de apariencia de fecha se conserva.

## Verificación funcional

Pruebas frontend de calendario/formulario compartido y regresión de recurrentes: permisos de API, defaults, PAID/SKIPPED, notas, importe siguiente opcional, PATCH sin campos de futuro, invalidaciones, conflictos, formulario único y foco.

Backend: unitarias, rutas y PostgreSQL real (`CALENDAR_PAYMENTS_DB_TEST=1`), incluyendo el flujo Gimnasio 40€/4 semanas `15/10 PAID → 12/11 SKIPPED → 10/12 accionable`, pagos anticipados y atrasados, aislamiento personal, archivados y dos peticiones concurrentes. La carrera produce un 201 y un 409, con un único pago/avance/auditoría. Fixtures con rollback o limpieza por UUID; no se utilizan pagos reales del usuario.

Una corrección histórica de un pago con `UPDATE_NEXT_AMOUNT` podía infringir un CHECK existente. El servidor ahora limpia solo metadata incompatible del registro y conserva su decisión previa en auditoría; no revierte ni altera el importe futuro. Documentado en `BudgetApp-Servidor/docs/API.md`.

Comandos de entrega: servidor `npm run prisma:validate`, `npm test` (también con las tres integraciones locales habilitadas), `npm run lint`; cliente `npm test`, `npm run lint`, `npm run build`; `git diff --check` en ambos repositorios.

Resultado final: **341 pruebas backend** (34 archivos, incluidas todas las integraciones) y **267 pruebas frontend** (41 archivos), todas correctas. Prisma validate, ambos lint, build del cliente y diff checks correctos. API local `/api/health` responde `ok`.

## Archivos de esta fase

Servidor:

- `src/services/calendar.service.js`
- `src/modules/finance/index.js`
- `docs/API.md`
- `tests/calendar.service.test.js`
- `tests/calendarPaymentsRoutes.test.js` (nuevo)
- `tests/calendarPayments.integration.test.js` (nuevo)
- `tests/customWeeksRoutes.test.js`
- `tests/financeDecisions.test.js`

Cliente:

- `src/pages/CalendarPage.jsx`
- `src/features/finance/PaymentOccurrenceForm.jsx` (nuevo)
- `src/features/finance/paymentOccurrence.js` (nuevo)
- `src/pages/RecurringExpensesPage.jsx`
- `src/features/finance/RecurringExpenseDetails.jsx`
- `src/pages/CalendarPage.test.jsx` (nuevo)
- `src/features/finance/PaymentOccurrenceForm.test.jsx` (nuevo)
- `src/pages/RecurringExpensesPage.test.jsx`
- `docs/UX_UI_PHASE_4_REVIEW.md` (este documento)
