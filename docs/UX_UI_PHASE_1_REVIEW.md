# Revisión UX/UI — Fase 1

Revisión de los cambios de esta fase según `docs/UX_UI_RULES.md`. Alcance: cliente, pantallas de gastos y filtro del desglose de presupuesto.

## Decisiones

- `ExpenseFilters` conserva un buscador con label visible y centraliza el desplegable, contador y limpieza. Admite filtros adicionales mediante `additionalFilters`, sin replicar el patrón en las páginas.
- «Ámbito» distingue comunes/personales; «Tipo de gasto» distingue recurrentes/facturas/variables/puntuales. El contador representa las selecciones del panel. La búsqueda no incrementa ese contador, pero «Limpiar filtros» también la borra.
- Los filtros permanecen aplicados al contraer el panel. La limpieza funciona con el panel cerrado. El despliegue ocupa espacio en el flujo normal, sin overlays ni animaciones de altura; la etiqueta del buscador conserva su fila.
- El tipo del presupuesto solo filtra sus líneas visibles. Totales y aportaciones siguen mostrando el cálculo completo. Un filtro sin coincidencias no se presenta como un presupuesto sin gastos.
- Gastos muestra una cuadrícula 2×2 en móvil. Cada tarjeta conserva icono, nombre a 16 px y enlace completo. Descripción y texto auxiliar de apertura se muestran desde `sm`; escritorio conserva cuatro columnas.
- La creación contextual de facturas usa `InvoiceForm.creationPreset`, separado de `initialInvoice`. Solo toma categoría, ámbito y persona del grupo; importe y notas comienzan vacíos y las fechas usan los valores habituales de creación.
- Solo hay un formulario contextual. Abrir otro grupo, editar o usar la creación global cierra el contextual. Tras guardar se actualizan histórico y estadísticas. Al cerrar o guardar vuelve el foco a su botón contextual, si sigue disponible.
- Si una categoría o persona histórica ya no está disponible, se explica y se requiere una selección válida. No se selecciona silenciosamente otra categoría o persona.

## Auditoría

| Estado | Zona y reglas | Resultado / corrección |
| --- | --- | --- |
| ✅ Correcto | Filtros: 18, 20, 24, 26, 42, 47 | Icono y texto «Filtros», label persistente, botón y campos de 48 px, limpieza de 44 px y un único patrón para las cinco páginas. |
| ✅ Correcto | Teclado y lectores de pantalla: 18, 23, 48 | Botones nativos, `aria-expanded` y `aria-controls` con IDs únicos; controles cerrados fuera del recorrido de teclado. Tab/Enter/Espacio, Escape y retorno del foco cubiertos por tests. |
| ✅ Correcto | Presupuesto: 19, 32, 48 | Tipos reales combinables con búsqueda, ámbito y categoría. Mensaje específico sin coincidencias y limpieza accesible. |
| ✅ Correcto | Tarjetas de Gastos: 2, 6, 22, 24 | Dos columnas desde el tamaño mínimo, menor padding móvil, iconos y nombres visibles, tarjeta completa pulsable y rutas conservadas. |
| ✅ Correcto | Facturas: 1, 21, 28, 42, 45, 50 | CTA contextual secundario, creación global conservada, formulario compartido compacto dentro del acordeón, presets específicos de creación. |
| ✅ Correcto | Formularios: 26, 30, 32, 48 | Labels, validación y campos de fecha existentes conservados; estados de preparación, error y guardado; errores de guardado mantienen los datos. |
| ✅ Correcto | Textos largos: 8, 48 | Títulos y CTA contextual envuelven texto; categorías y campos usan contenedores que pueden reducirse. Se elimina el truncado del nombre de gastos puntuales y se permite partir nombres largos en Variables y estadísticas de facturas. |
| ✅ Correcto | Regresiones: 42, 46 | Pruebas de edición, borrado y documentos de facturas conservadas; creación contextual y global probadas por separado. Sin dependencias nuevas. |
| ⚠️ Mejorable | Verificación visual: 48 | Revisión estructural de breakpoints, anchos y targets realizada. Falta la comprobación visual real a 320 px, tablet y escritorio: la herramienta de navegador no dispone de ninguna superficie y rechaza crear una pestaña. JSDOM verifica interacción y DOM, pero no permite medir el layout ni el desbordamiento horizontal. |

No se han introducido excepciones funcionales a la guía. La validación visual pendiente es una limitación de verificación, no una confirmación de ausencia de desbordamientos.

## Comprobaciones ejecutadas

- `npm test`: 156 pruebas superadas en 36 archivos. Incluye tres archivos de tests nuevos (`expensePageShared`, `OneTimeExpensesPage`, `ExpensesPage`) y ampliaciones de `BudgetPage` e `InvoicesPage`.
- `npm run lint`: correcto.
- `npm run build`: correcto.
