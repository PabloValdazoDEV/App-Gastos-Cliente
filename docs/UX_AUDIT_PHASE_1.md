# Auditoría UX/UI — Fase 1

Alcance revisado: layout, navegación, dashboard inicial, páginas vacías, estados de feedback y 404. Referencia: `docs/UX_UI_RULES.md`.

## Hallazgos

- `✅ Correcto` — Dashboard, reglas 1, 2 y 19: la pregunta principal abre la pantalla, la aportación ocupa la mayor prioridad y el único CTA destacado explica su destino.
- `✅ Correcto` — Dashboard, reglas 14 y 48: el estado pendiente combina texto y símbolo; muestra `— €` y una explicación en lugar de inventar un cero o una cifra de demostración.
- `✅ Correcto` — Navegación, reglas 18 y 41: hay exactamente cinco destinos móviles, todos con icono familiar y etiqueta visible. Las opciones secundarias se agrupan en “Más”.
- `✅ Correcto` — Interacción móvil, reglas 22, 24 y 25: CTA, enlaces de marca y navegación mantienen targets cómodos y la navegación frecuente queda al alcance del pulgar.
- `✅ Correcto` — Jerarquía y composición, reglas 3, 4, 5 y 6: páginas, tarjetas y bloques utilizan la misma rejilla, escala de separación y alineación izquierda.
- `✅ Correcto` — Color y legibilidad, reglas 9, 10, 14 y 16: la paleta usa tokens semánticos, bases suaves y texto casi negro; los estados combinan icono, título y descripción.
- `✅ Correcto` — Accesibilidad, reglas 17, 18 y 23: hay foco visible, enlace para saltar al contenido, landmarks con nombre, jerarquía de títulos y affordances reconocibles.
- `✅ Correcto` — Estados, reglas 44 y 48: existen componentes específicos de carga estructurada, vacío, error recuperable, éxito y acceso restringido; la reducción de movimiento desactiva la animación del skeleton.
- `✅ Correcto` — Contenido real y responsive, reglas 7, 48 y criterio mobile-first: los textos largos quedan a la izquierda, las rejillas colapsan sin tablas ni scroll horizontal y la base funciona desde 320 px, cubriendo el objetivo de 375 px.
- `✅ Correcto` — Formularios, reglas 26 a 32: no se muestra un formulario sin caso funcional en Fase 1. React Hook Form y Zod quedan preparados para incorporar labels persistentes, ayuda y errores asociados en las fases correspondientes.

## Excepciones

No se han identificado excepciones a la guía en esta fase.

## Comprobaciones automatizadas

La suite verifica los cinco destinos móviles, el enlace de salto, el dashboard sin importes ficticios, la salida del 404, la validación del entorno y el coordinador single-flight. Con las dependencias fijadas por lockfile se han superado `npm run lint`, `npm test` y `npm run build`.
