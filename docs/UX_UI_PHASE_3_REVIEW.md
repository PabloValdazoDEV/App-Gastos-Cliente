# Auditoría UX/UI · Fase 3: periodicidades reales por semanas

Fecha: 17 de septiembre de 2026.

Alcance: creación/edición, listado y detalle de gastos recurrentes. Se conservan las Fases 1 y 2, el margen de seguridad, el registro de pagos y las reglas de avisos. Sin cambios visuales de dashboard ni acciones de calendario.

## Cambios y decisiones

- Mensual sigue seleccionado inicialmente. «Cada varias semanas» se sitúa junto a «Semanal», antes de las frecuencias por meses naturales.
- Solo se muestra el intervalo correspondiente a la periodicidad seleccionada. El nuevo campo «Se repite cada (semanas)» reutiliza `FormField`, con label persistente, input numérico, teclado numérico y límites de 2 a 520 semanas enteras.
- En la primera selección se sugiere 4 únicamente si el campo está vacío. Alternar entre semanas y meses conserva ambos borradores; vaciar el campo no hace reaparecer la sugerencia. El payload solo incluye el intervalo compatible y envía el otro como `null`.
- La ayuda calcula localmente N × 7 y explica que «cada 4 semanas» son 28 días, no un mes natural. Un intervalo inválido muestra instrucciones de corrección y no una equivalencia engañosa.
- Opciones y etiquetas se centralizan en `recurringFrequency.js`. El listado y el detalle muestran «Cada N semanas»; `WEEKLY` sigue mostrando «Semanal» y los meses personalizados muestran su intervalo.
- Guardar o registrar/corregir pagos invalida calendario y cálculos dependientes; se reutiliza el helper de invalidación de la Fase 2, sin recarga completa.

## Checklist y hallazgos

| Estado | Zona y reglas | Comprobación / corrección |
| --- | --- | --- |
| ✅ Correcto | Formulario: jerarquía, alineación y campos mínimos (1–8, 26–31, 47) | Se conserva un único CTA de guardado y el grid del formulario. El intervalo adicional solo aparece cuando corresponde. |
| ✅ Correcto | Claridad del dato y contenido (19, 30–32, 49–50) | Ayuda dinámica para 2, 3, 4, 5 y 520 semanas; explica el desplazamiento del cobro respecto al mes. Label real «Cada 4 semanas» en listado y detalle. |
| ✅ Correcto | Teclado y accesibilidad (14, 18, 26, 32) | Input accesible por Tab/Shift+Tab; ayuda mediante `aria-describedby`; error con `role="alert"`, `aria-invalid` y foco automático al enviar un intervalo inválido. |
| ✅ Correcto | Carga, error y éxito (20–24, 40–44) | CTA desactivado con «Guardando gasto…»; error visible conserva el intervalo para reintentar; éxito cierra el formulario después de invalidar consultas. Se mantienen estados de carga, vacío, permisos y fallos de consultas existentes. |
| ✅ Correcto | Consistencia, color y tipografía (9–18, 42–46) | Se reutilizan FormField, SelectField, FormCard, StatusBadge y tokens existentes. No se introduce una variante visual nueva ni información dependiente solo del color. |
| ✅ Correcto | Borradores y compatibilidad (28, 47–50) | Alternar no pierde valores ni sobrescribe datos escritos. La edición precarga intervalo, importe, fechas y margen; un margen explícito 0 se conserva. |
| ✅ Correcto | Responsive estructural y targets (22–25, 48) | Campo `w-full` con `min-h-12`; formulario a una columna antes de `sm`, CTA de ancho completo y detalle con `min-w-0`/texto ajustable. Verificado por estructura DOM, no por render real. |
| ⚠️ Mejorable | Verificación visual móvil, texto largo y contraste real (15, 48) | La sesión no dispone de navegadores: `cua.getState()` devolvió listas vacías y abrir `iab` devolvió «Browser is not available». Pendiente verificar visualmente en 320/375 px y escritorio, con zoom 200 %, nombre largo, ayuda y errores. No se afirma una QA visual realizada. |

No se han detectado incumplimientos nuevos en la revisión de código y pruebas DOM. No hay excepciones funcionales a la guía; el único límite es la comprobación visual pendiente por ausencia de navegador.

## Verificación automatizada

- `npm test`: 216 pruebas correctas en 38 archivos.
- `npm run lint`: correcto.
- `npm run build`: correcto.
- Nuevas pruebas de esta fase: 22 casos de pantalla y 26 casos del helper, además de las 12 pruebas de recurrentes previas conservadas. Cubren default mensual, intervalos válidos, vacíos, 0, 1, negativos, decimales y máximo, etiquetas, edición, cambios de periodicidad, errores accesibles, teclado, estructura responsive, carga/error/reintento e invalidaciones.

El cálculo de fechas, equivalente presupuestario, reservas y normalización definitiva de datos se verifican en los tests del servidor; el cliente no duplica esas fórmulas.
