# Revisión UX/UI — fase 2: márgenes de seguridad

Alcance: controles de margen en facturas, variables y puntuales, explicación del presupuesto. Se conservan los filtros y acordeones de fase 1. No se modifica la interfaz del dashboard, calendario ni recurrentes.

## Revisión según UX_UI_RULES.md

- ✅ **Propiedad y claridad (19, 28, 47, 50):** facturas usan un único control dentro del acordeón por categoría/propietario; variables lo sitúan en la tarjeta estadística del grupo, separado del mes histórico. Solo puntuales tienen un checkbox individual.
- ✅ **Consistencia (42, 43, 46):** `BudgetMarginControl` comparte persistencia y estados entre facturas/variables; `SafetyMarginCheckbox` comparte el campo nativo con puntuales. Se usan tokens existentes, bordes, radios y tipografía del proyecto.
- ✅ **Accesibilidad (14, 24, 26, 31):** checkbox nativo, label persistente, fieldset/legend, ayuda con `aria-describedby`, nombre de grupo accesible, foco visible y área de label de altura mínima `min-h-11`. Probados foco con Tab y cambio con Espacio.
- ✅ **Estados (32, 44, 48):** deshabilitado durante carga/guardado, error de consulta con reintento, error de guardado junto al control, estado previo conservado tras fallo y confirmación de guardado. Un grupo sin datos no inventa una recomendación; conserva el estado vacío de medias.
- ✅ **Continuidad (40, 50):** guardar no cierra el acordeón. Se invalidan presupuesto, dashboard, estadísticas, simulación y planificación sin recarga completa.
- ✅ **Jerarquía (1, 2, 6):** importe recomendado como principal, medias históricas separadas. Presupuesto muestra «Sin margen · Base…» cuando el porcentaje efectivo es cero, y base + porcentaje + importe del margen cuando es positivo.
- ✅ **Formularios (26, 28, 35):** nuevos puntuales empiezan desmarcados; editar recupera el valor guardado. No se añade un porcentaje manual.
- ✅ **Datos reales y responsive — estructura (7, 48):** etiquetas y nombres permiten varias líneas con `min-w-0`/`break-words`; se conservan grids y breakpoints existentes. El origen/porcentaje procede del backend y distingue categoría, general y cero.
- ⚠️ **Verificación visual (48):** comprobados DOM, accesibilidad básica, estados y compilación; no se pudo realizar inspección visual en navegador porque esta sesión no tiene un navegador disponible. Pendiente comprobar manualmente móvil y escritorio con nombres largos.

## Verificación automatizada

Tests de páginas y control compartido cubren activación/desactivación, recomendado actualizado, media histórica separada, acordeón conservado, defaults y edición de puntuales, errores, carga, teclado e invalidaciones. La suite completa del cliente, lint y build se ejecutan como comprobación final.

No se introducen excepciones deliberadas a la guía ni rediseños generales.
