# Fase 6.4 — Integración financiera de compras

## Alcance y reglas

Una compra conserva su dominio. Su plan de pagos alimenta el cálculo financiero estándar: no se crean gastos puntuales, recurrentes, facturas ni `ExpensePayment` artificiales. Documentos y garantías permanecen independientes; no hay OCR, IA ni Telegram.

| Fuente | Mes de presupuesto | Gasto utilizado |
| --- | --- | --- |
| Contado confirmado | Fecha de pago, importe pagado | Mismo mes e importe |
| Entrada pendiente | Mes de compra | No suma |
| Entrada confirmada | Fecha de pago de entrada | Mismo mes e importe |
| Cuota PLANNED | Vencimiento, importe previsto | No suma |
| Cuota PAID | Vencimiento, importe previsto original | Fecha de pago real, importe real |
| Cuota CANCELLED | No suma | No suma |

El pago anticipado puede caer en un mes distinto del vencimiento: se explica en el formulario y en el calendario. No se cambia silenciosamente el presupuesto esperado para absorber sobrepagos. Las compras no añaden un margen extra ni modifican automáticamente saldos bancarios registrados.

HOUSEHOLD se contabiliza como común; PERSONAL en su persona; SPLIT en las partes personales correspondientes, nunca como gasto común. El reparto centralizado distribuye el resto de céntimos de forma determinista. Las fuentes financieras visibles contienen solo la parte propia y los pagos comunes.

## Historial, propiedad y preparación

- Cada pago confirmado guarda una instantánea privada del reparto y del usuario vinculado. Cambiar la propiedad solo cambia obligaciones pendientes; las correcciones de importe/fecha conservan la asignación original.
- Volver una cuota a pendiente requiere confirmación y auditoría. Retira el utilizado; la obligación pendiente vuelve a usar la propiedad actual. Un nuevo pago captura ese reparto actual.
- La migración aditiva `20260917233000_purchase_financial_allocations` toma la propiedad disponible al migrar para pagos de 6.3 ya confirmados. No puede reconstruir propietarios anteriores y no inventa nuevos pagos.
- Archivar conserva el historial pagado, pero retira obligaciones pendientes del presupuesto y calendario. La confirmación explica que archivar no cancela una deuda con la entidad.
- Quien conserva una asignación histórica, pero ya no puede consultar la compra, ve un concepto genérico sin enlace, notas privadas ni título actual.
- Inicio y Planificación recalculan recomendaciones con el presupuesto estándar actual. Si difiere del mes preparado, avisan; no sobrescriben la preparación ni los saldos confirmados.
- La preparación guarda identidad vinculada para proteger los importes y saldos personales históricos ante cambios de usuario. Los registros antiguos sin identidad verificable se conservan en BD, pero no se utilizan para mostrar datos personales privados.

## Auditoría UX/UI

| Zona | Resultado | Comprobación |
| --- | --- | --- |
| Presupuesto | Correcto | Filtro Compras junto a los anteriores; contado, entrada y cuota con concepto explicativo; total independiente de filtros. |
| Reparto | Correcto | «Tu parte» y porcentaje para SPLIT; no se muestra la parte privada de otro participante. |
| Inicio | Correcto | Mismos bloques común/personal, utilizado/restante/exceso y cobertura; próximos pagos enlazan al dominio correcto. |
| Calendario | Correcto | `sourceType` explícito; distingue cuota/entrada/contado de recurrentes. No ofrece Omitir para compras. |
| Pago de cuota | Correcto | Solo primera PLANNED accionable, incluido anticipo; tras guardar habilita la siguiente según backend. |
| Importe de SPLIT | Correcto | Calendario muestra parte propia; antes de registrar consulta detalle autorizado e informa que el formulario paga la cuota completa. |
| Fechas | Correcto | Label persistente y control nativo con protecciones globales de ancho; vencimiento y fecha de pago tienen significado distinto. |
| Teclado | Correcto | Foco inicial/error, restauración al cancelar/guardar y alternativa en cabecera si cambia la acción. |
| Concurrencia | Correcto | Errores recuperables conservan entradas; acciones obsoletas se cierran/refrescan sin convertir automáticamente un pago inicial en corrección. |
| Privacidad/caché | Correcto | Renovación de autorización antes de mostrar detalle cacheado; aislamiento de hogares, rangos y respuestas tardías. |
| Planificación | Correcto | Cambiar de hogar descarta saldos/borradores; respuesta tardía no introduce datos o avisos en otro hogar. |
| Invalidaciones | Correcto | Compra/detalle, presupuesto, todas las variantes de inicio/calendario, simulación y planificación; sin recarga, sin crear otros gastos ni alterar cuentas. |
| Responsive | Correcto | Revisión de 36 combinaciones en Chromium: 9 estados a 320, 375, 768 y 1280 px. Sin desbordamientos ni controles visibles menores de 44 px. |
| Safari/iPhone físico | Pendiente | No se ha probado en dispositivo físico. Las medidas de Chromium no equivalen a una prueba de Safari. |

## Verificación

- Antes de modificar: 679 pruebas backend (44 archivos) y 559 frontend (57 archivos), todas correctas, incluidas las integraciones PostgreSQL habilitadas.
- Final: 737 pruebas backend (48 archivos) y 619 frontend (59 archivos), todas correctas. Prisma validate, lint de ambos repositorios, build del cliente y diffcheck correctos. Los flags PostgreSQL de todas las fases se activaron, incluidos `PURCHASE_FINANCE_DB_TEST=1` y `PURCHASE_ALLOCATION_DB_TEST=1`.
- Pruebas nuevas: contado y meses, entrada pendiente/pagada, cuotas esperadas/reales, sobrepresupuesto, reparto exacto, permisos, snapshots históricos, ausencia de doble contabilidad, preparación/simulación, calendario y cambios de orden.
- Frontend: filtros, textos, importes propios, transporte del pago completo, invalidaciones, actualización de Inicio, permisos caducados, borradores por hogar, respuestas tardías, accesibilidad y foco.
- QA navegador con componentes reales y servicios ficticios: filtro Compras, textos largos/importes grandes, calendario común/SPLIT, formulario de pago, Inicio y Planificación. El flujo calendario → pagar 52 € → Inicio conserva presupuesto de 50 €, muestra utilizado 52 € y exceso 2 €, habilitando la siguiente cuota sin recargar, en las cuatro anchuras.
- API/BD se verifican por separado con Supertest y PostgreSQL en transacciones revertidas. No se han creado compras ni pagos de prueba en los hogares reales del usuario.
- Captura a 375 px revisada visualmente en un iframe de ancho fijo (Chrome macOS impone un ancho mínimo a su ventana principal). No se afirma prueba física de iPhone ni lector de pantalla.
- Migración aplicada y Prisma generado localmente. API comprobada a través de `http://192.168.1.99:5173/api/health`: BudgetApp, development, estado `ok`.

## Límites deliberados

No se mueven saldos bancarios automáticamente. No se añade refinanciación destructiva, omisión de cuotas ni visor de documentos archivados. El registro de pagos sigue requiriendo confirmación humana y la estructura financiada con cuotas pagadas sigue protegida.
