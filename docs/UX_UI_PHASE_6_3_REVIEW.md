# Fase 6.3 — Formas de pago y financiación de compras

## Alcance

Modelo de cómo se paga un bien, separado del precio y de la propiedad de la compra. No integra BudgetPage, Dashboard, monthlyProgress, Calendar general, cuentas, gastos puntuales ni recurrentes. No altera la lógica de documentos, productos o garantías. No incluye OCR, IA, Telegram ni la fase 6.4.

## Decisiones de producto

- Al contado guarda fecha e importe real, sin crear una financiación artificial. En nuevas compras los campos son visibles y se explica que guardar registra el pago. Las compras anteriores permanecen sin pago confirmado; modificar su tienda o notas no inventa pagos.
- Financiado distingue precio, entrada, principal, cuotas, coste de financiación y coste total previsto. Ejemplo: precio 1200 €, entrada 200 €, principal 1000 €, cuotas 1100 €, coste financiero 100 €, coste final 1300 €.
- La entrada no es una cuota. Solo se considera pagada con confirmación explícita y fecha; por defecto sigue pendiente, aunque la compra sea histórica.
- El calendario usa meses naturales, anclados al día de la primera cuota: 31 enero → 28/29 febrero → 31 marzo. La última cuota ajusta los céntimos para que la suma sea exacta. Se admite un máximo de 1200 cuotas y se rechaza una última cuota no positiva.
- Pagado suma importes reales de cuotas PAID y la entrada confirmada. Pendiente suma importes esperados de cuotas PLANNED y la entrada no confirmada. Un sobrepago no paga automáticamente otra cuota; los costes contractuales permanecen separados de los importes reales.
- Cambiar contado ↔ financiado es posible sin cuotas pagadas. Retirar un pago al contado o modificar una entrada ya pagada exige confirmación y registra los valores anteriores/nuevos en auditoría.
- Se aplica la preferencia conservadora del encargo: con cuotas PAID se bloquea cambiar método, precio o estructura del plan; se permite editar entidad y datos no estructurales de la entrada. No se propone borrar pagos legítimos para eludir la protección. La refinanciación no se implementa.
- Pagar anticipadamente está permitido. La fecha de un pago realizado no puede ser futura según la zona horaria del hogar. Corregir un pago conserva auditoría; PAID → PLANNED exige confirmación. CANCELLED se presenta como anulada, no como “omitir”, y no se ofrece una acción de salto.

## Auditoría UX/UI

| Zona | Resultado | Regla y comprobación |
| --- | --- | --- |
| Selector de pago | ✅ Correcto | Dos radios visibles, etiquetas en castellano y campos condicionales; no se exponen enums. |
| Resumen económico | ✅ Correcto | Se separan el bien y los pagos; cálculos en vivo en céntimos y ayuda sobre última cuota ajustada. |
| Formularios | ✅ Correcto | Labels persistentes, importe decimal, fecha nativa, límites y errores junto al campo. Fecha/importe del pago al contado se pueden editar. |
| Entrada | ✅ Correcto | Checkbox explícito, fecha condicional y explicación de que no cuenta como cuota. |
| Historial | ✅ Correcto | Bloqueo explicado cuando existen cuotas pagadas; confirmación específica para retirar registros y revertir cuotas. |
| Progreso | ✅ Correcto | Importe pagado, pendiente, número de cuotas y próxima fecha/importe. Estado textual además de color. |
| Acciones | ✅ Correcto | Guardar es la acción principal del formulario; prevención de doble envío y acciones incompatibles bloqueadas. |
| Teclado y foco | ✅ Correcto | Foco inicial, primer error, Cancelar/Escape y ciclo de Tab en confirmaciones; restauración tras actualizar el detalle, con cabecera como alternativa si desaparece la acción. |
| Estados | ✅ Correcto | Sin pago confirmado, sin entrada, sin cuotas pendientes, errores y éxito explícitos; los errores conservan los datos introducidos. |
| Privacidad | ✅ Correcto | Datos/formularios se ocultan al perder acceso; separación por hogar/compra; respuestas tardías tras desmontar no repueblan el detalle. |
| Caché | ✅ Correcto | Pagar/corregir/revertir invalida únicamente listado y detalle de compras, sin refrescar módulos financieros ni documentos. |
| Móvil y fechas | ✅ Correcto | Componentes existentes con `min-w-0`, ancho acotado y rejilla responsive. Textos largos se ajustan sin ocultar información. |
| Verificación Safari/iPhone | ⚠️ Mejorable | No se ha probado en un dispositivo físico. Se conservan las protecciones globales de fechas existentes y se comprueba Chromium a anchuras móviles. |

## Verificación

- Partida: 578 pruebas backend (incluidas integraciones PostgreSQL) y 462 frontend, todas correctas. El primer intento de HTTP dentro del sandbox falló por puertos restringidos; la ejecución con permisos locales pasó antes de modificar código.
- Backend final: 679 pruebas en 44 archivos, incluyendo 101 nuevas de pagos: 65 de cálculo/esquemas, 17 HTTP/seguridad y 19 PostgreSQL. Fixtures transaccionales revertidas y restricciones diferidas comprobadas. El caso de 1200 cuotas también se verifica en base real.
- Frontend final: 559 pruebas en 57 archivos, 97 más que la partida. Cobertura de formularios, cálculos, transporte, progreso, cuotas, pago anticipado, correcciones, confirmaciones, privacidad, aislamiento y foco; suite completa, lint/build y diffcheck correctos.
- QA de Chromium: 56 combinaciones, 14 estados a 320, 375, 768 y 1280 px. Sin desbordamientos de contenido ni controles visibles por debajo de 44 px de altura. Flujos pagar → corregir importe → volver a pendiente comprobados en las cuatro anchuras con servicios de prueba; API/BD se verifican por separado en las integraciones.
- Captura móvil revisada visualmente: resumen, formulario de pago y campos de fecha dentro de sus contenedores. La comprobación no afirma emulación de Safari, lector de pantalla ni acceso a los datos reales del usuario.
- Migración aditiva `20260917230000_add_purchase_payments` aplicada localmente y cliente Prisma generado. Los datos anteriores permanecen y no se infieren fechas/importes de pago.
- API local comprobada en `http://192.168.1.99:5173/api/health`: servicio BudgetApp, desarrollo, estado correcto.

## Límites deliberados

No existe integración financiera automática ni se cambia ningún saldo al marcar una cuota pagada. El calendario mostrado es exclusivamente el de esa compra. El historial detallado queda registrado en AuditLog; esta fase no incorpora un visor general de auditoría ni refinanciación. Se mantiene el comportamiento previo de archivado y documentos.
