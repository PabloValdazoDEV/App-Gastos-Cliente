# Revisión UX/UI — campos de fecha dentro del marco

## Ajustes

- `FormField`: el contenedor y el input admiten contracción (`min-w-0`) y limitan su ancho al espacio disponible. Se mantienen labels, foco, altura táctil, ayudas, errores y refs.
- CSS común de `date`/`month`: ancho 100 %, máximo 100 % y mínimo 0, incluido el valor interno de WebKit. No se elimina el selector nativo ni su indicador y no se oculta el overflow de tarjetas o página.
- Tras recibir la captura del iPhone, se añade `-webkit-appearance: none; appearance: none` únicamente a fechas/meses. El exceso mostrado coincide con los 28px de padding horizontal y con el [bug WebKit 301648](https://bugs.webkit.org/show_bug.cgi?id=301648): el marco nativo puede sumar el padding a `width: 100%` incluso con `border-box`. Se conserva el padding del diseño, la altura mínima, el tipo de input y su selector nativo; no se resta un ancho fijo ni se oculta el desbordamiento. [Bootstrap usa este reset para fechas Safari](https://github.com/twbs/bootstrap/blob/main/scss/forms/_form-control.scss); [appearance no cambia la funcionalidad nativa](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/appearance).
- Recurrentes y edición/registro de pagos: las columnas se calculan con el ancho real del formulario (`auto-fit`), no solo con el viewport, evitando comprimir fechas al aparecer la barra lateral o abrir detalles anidados. Cada columna conserva 14rem cuando hay espacio y se apila cuando falta.
- Historial/avisos y campos directos de Planificación/Simulador: los contenedores permiten contraerse dentro de sus grids.

## Auditoría según UX_UI_RULES.md

- ✅ Reglas 3–5, 24, 26, 30, 42 y 46: corrección compartida de dimensiones; se conservan controles nativos, tokens, funcionalidad y jerarquía.
- ✅ Reglas 32 y 48: pruebas DOM para límites/valores, ref, errores y ayuda accesible, interacción y contenedores responsive; suites de formularios y compilación comprobadas.
- ⚠️ Regla 48: recibida la captura de Safari/iPhone en el formulario de gasto recurrente: las fechas sobresalen a la derecha respecto a importe/periodicidad y al borde de la tarjeta. No hay navegador conectado ni iPhone disponible para verificar la geometría después del cambio; las pruebas DOM no sustituyen esa comprobación. Pendiente recargar en su dispositivo, contrastar ambos bordes, probar fecha vacía/rellena y abrir el calendario (también a 320/375px y con barra lateral).

No se cambian fechas, reglas de periodicidad, cálculos ni datos guardados. No se afirma verificación visual mediante pruebas DOM.
