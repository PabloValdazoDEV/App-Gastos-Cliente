# Revisión UX: una compra, un producto

Recorrido: **Compras → Añadir compra → Subir ticket o factura → Analizar y rellenar con IA → elegir producto → revisar → Guardar compra**. Existe entrada manual y alternativa manual conservando el archivo si falla la IA. Los documentos se añaden o eliminan después desde la ficha.

## Auditoría según UX_UI_RULES.md

- ✅ Correcto — Alta, reglas 1/20/28/40/47: la subida está al principio, con progreso y una acción principal por etapa; no exige crear previamente una compra ni duplica el precio del producto. Garantía, propiedad y financiación siguen siendo decisiones explícitas.
- ✅ Correcto — Selección, reglas 26/32/33: labels persistentes y radios para escoger un producto. Un ticket multiproducto no asigna su total a cada línea. Moneda desconocida o distinta obliga a completar importes; no hay conversión implícita.
- ✅ Correcto — Estados, reglas 14/32/48: consentimiento, procesando, error, reintento, entrada manual, borradores y confirmación de eliminación. Se conservan valores tras un fallo de guardado. Foco al cambiar de etapa y al cancelar el flujo; controles y campos reutilizados.
- ✅ Correcto — Gastos, reglas 19/42/49: secciones de compras vinculadas en Puntuales/Recurrentes, con búsqueda propia, documentos, margen 0 %, fin de financiación, cuota final y registro de pagos en línea. No se crean gastos duplicados. Los importes de tarjetas son los de la compra completa; el presupuesto mantiene el reparto autorizado.
- ✅ Correcto — Compatibilidad: las compras antiguas multiproducto permanecen intactas. Las nuevas de un solo producto impiden añadir productos desde la ficha o desde otro análisis; sí admiten nuevos archivos.
- ⚠️ Mejorable — Regla 48: verificados DOM, teclado, estados y reglas mediante pruebas automatizadas, más compilación; no se ha realizado inspección visual en un navegador real en esta ejecución. Pendiente revisar a 320/375 px y escritorio con un ticket real. Las clases mantienen min-w-0, quiebre de nombres largos, rejillas adaptativas y targets del sistema.
- ⚠️ Mejorable — Recuperación: se conservan archivo y análisis durante 24 horas desde la subida; las ediciones locales del formulario se descartan al cerrar. La retención temporal se explica junto al archivo; no se promete autoguardado de campos.

## Decisión financiera

Las tarjetas vinculadas leen las compras y sus pagos canónicos, en vez de crear copias independientes de gastos. Editar una compra o registrar una cuota refresca todas las vistas financieras. No se introduce un margen opcional ni se dan por pagadas las cuotas futuras.

## Pruebas

`PurchaseCreateFlow.test.jsx`, `purchaseIntakeState.test.js` y `PurchaseLinkedExpenses.test.jsx`: subida inicial, consentimiento, selección, revisión, precio en céntimos, moneda, valores desconocidos, fallo de IA, conservación del archivo, reanudación, eliminación explícita, reintento de guardado y cuotas vinculadas. La batería anterior mantiene cobertura de adjuntos, pagos y compras históricas.

El proveedor de IA se simula en pruebas: no se han enviado documentos reales ni consumido llamadas de pago para esta verificación.

## Ajuste de unidades, fecha y garantía (18/09/2026)

- ✅ Correcto — Reglas 26/28/32: cantidad visible junto al nombre en las altas de un producto y en su edición, fuera de «Más datos». Se respetan unidades detectadas; un cociente exacto de precio unitario/total puede proponerse como cantidad calculada. En ausencia de evidencia, se propone **1 unidad** con aviso explícito, sin modificar la extracción original. Importes y monedas siguen separados.
- ✅ Correcto — Fechas: se conserva la fecha detectada (incluidos años bisiestos); si no se detecta, queda vacía y se pide al guardar, sin usar silenciosamente el día actual.
- ✅ Correcto — Garantía documental: la IA solo extrae duración o fecha fin de la garantía del producto completo explícita en el documento. No deduce plazos por marca o categoría ni confunde devolución con garantía. El formulario muestra el origen y permite corregirlo. La garantía no se persiste antes de confirmar la compra.
- ✅ Correcto — Sugerencia legal: opción separada aplicable a bienes nuevos comprados por consumidores a profesionales en España desde 2022. Exige confirmar estas condiciones y que la entrega coincide con la fecha de compra. No altera la garantía actual sin acción explícita; para otra fecha de entrega se indica fecha fin manual. Cambiar la fecha invalida la confirmación de la sugerencia. Fuente: [BOE, artículos 120 y 123](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555#a120).
- ✅ Correcto — Borradores: se puede repetir el análisis del mismo archivo, con consentimiento renovado; los análisis anteriores se conservan.
- ⚠️ Mejorable — Sigue pendiente inspección visual en navegador real y extracción con el ticket real del usuario. Las pruebas de UI, contratos e integración usan documentos/proveedor simulados y no consumen llamadas de IA.

La extracción conserva un JSON Schema estricto con campos desconocidos nulos, siguiendo [OpenAI Docs: Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Se mantiene compatibilidad con análisis guardados antes de incorporar `warranty`.

## Apertura de tarjetas de compra

- ✅ Correcto — Reglas 18/20/23/24: toda la superficie de la tarjeta es un enlace a la ficha, incluido el espacio interior, comercio, importe y garantía. «Ver compra» con flecha hace visible la acción sin depender del hover.
- ✅ Correcto — Reglas 42/43: colores, borde, radios y espaciado del sistema; respuesta visual al hover y foco visible en toda la tarjeta. Nombres largos admiten salto de línea.
- ✅ Correcto — Teclado y semántica: un único enlace nativo por tarjeta, sin botones ni enlaces anidados. Nombre accesible del producto, descripción «Ver compra», navegación con Tab/Enter y comportamiento nativo para abrir en otra pestaña.
- ✅ Correcto — Pruebas: navegación desde comercio, importe, garantía y CTA, además de Tab/Enter y ausencia de controles interactivos anidados. No cambia filtros, permisos, datos ni pagos.
- ⚠️ Mejorable — No se ha realizado inspección visual en navegador real para este ajuste; la comprobación de interacción se realiza con pruebas de DOM y compilación.
