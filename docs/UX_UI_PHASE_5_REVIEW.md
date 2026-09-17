# Fase 5 — Progreso presupuestario y cobertura de saldos

## Alcance

Implementación en Cliente y Servidor sin nueva migración ni cifras derivadas persistidas. Se conservan filtros, márgenes efectivos, CUSTOM_WEEKS, calendario interactivo y formulario compartido de pagos. No se incorporan módulos de fases posteriores.

## Contrato y cálculos

- `calculateMonthlySpendingProgress` (servidor) recibe entradas explícitas y devuelve `monthlyProgress.{common,personal}` y `cashCoverage.{common,personal}`. Personal es un objeto o null, nunca una lista de datos ajenos.
- Presupuesto: recomendación actual con márgenes efectivos y puntuales del mes. No es la aportación preparada ni incluye ajustes temporales de recuperación.
- `rawRemainingCents = budgetCents - usedCents`; se conservan restante positivo y exceso por separado. El progreso puede superar 100 %. Si presupuesto y utilizado son cero, progreso 0; con presupuesto cero y utilizado positivo, porcentaje null y exceso explícito.
- En presupuesto / cerca del límite (desde el 80 % exacto) / presupuesto superado. Estos estados no describen el saldo bancario.
- Cobertura: saldo registrado menos presupuesto restante, con colchón firmado y faltante positivo. Cubierto / falta saldo son estados independientes del presupuesto.
- Se priorizan las cuentas activas actuales. Sin ellas, común usa el saldo del hogar; personal usa su confirmación mensual si existe, o null. No se suman saldos comunes y personales.
- Los campos legacy de planificación/simulación conservan su semántica anterior. El Dashboard usa exclusivamente `cashCoverage` para mostrar cobertura, no `accountSummary` ni el saldo de una preparación antigua.

## Reglas temporales y privacidad

| Origen | Utilizado | Mes de imputación |
| --- | --- | --- |
| Recurrente PAID | Importe real, no previsto | `dueDate`, aunque se pague después; un padre archivado no borra el pago |
| Recurrente SKIPPED | No suma | — |
| Variable DETAIL | Suma de entries, aunque el mes no esté cerrado | `year/month` del registro |
| Variable SUMMARY | `summaryAmountCents` | `year/month` del registro |
| Factura | Importe completo | `chargeDate`, o `invoiceDate` si no hay fecha de cobro |
| Puntual | No suma automáticamente | Su fecha determina el presupuesto, no acredita un pago |

Se reutilizan las utilidades de fechas civiles UTC de `@db.Date`. Los pagos se consultan una sola vez por intervalo mensual semiabierto, aprovechando el índice existente, sin cargar todo su histórico. Facturas/variables reutilizan las entradas necesarias para las recomendaciones históricas, sin modificar esas recomendaciones. El filtro SQL y el cálculo excluyen personales ajenos, también para OWNER; el total de planificación se sanea para evitar inferir esos datos por resta.

## Revisión UX

| Zona | Resultado | Regla y decisión |
| --- | --- | --- |
| Encabezado y tarjeta principal | ✅ Correcto | Reglas 2, 6, 19: “¿Cómo vais este mes?”, restante o exceso dominante; presupuesto, utilizado y restante con etiquetas explícitas |
| Cobertura | ✅ Correcto | Reglas 14, 47: bloque independiente inmediatamente posterior, saldo registrado, restante y colchón/faltante; nunca “Puedes gastar” |
| Barra | ✅ Correcto | No depende solo del color; min/max/valor accesibles, descripción y porcentaje real en texto, barra visual limitada al 100 % |
| Preparación y aportaciones | ✅ Correcto | Reglas 2, 47: estimado si no hay planificación y aviso de saldos sin confirmar; desglose común/personal/ajuste/total permanece más abajo |
| Personal | ✅ Correcto | Dos bloques separados, sin total mezclado. Saldo desconocido se indica como no registrado, nunca como cero |
| Ayuda | ✅ Correcto | Reglas 6, 47: reglas detalladas en un desplegable; advertencias breves sobre saldos manuales y margen |
| Actualización | ✅ Correcto | Invalidación compartida tras pagos, variables, facturas, puntuales, cuentas y preparación; la consulta activa se vuelve a solicitar sin recargar |
| Móvil e importes grandes | ✅ Correcto | Reglas 3, 48: métricas en filas a ancho pequeño; columnas en ancho suficiente; aportaciones con malla basada en espacio disponible y saltos de línea sin ocultar cantidades |
| Estados | ✅ Correcto | Carga, error con reintento, hogar/reparto pendiente, presupuesto cero, exceso, falta saldo, ausencia de saldo personal y respuesta incompleta diferenciados |
| Interacción | ✅ Correcto | Acciones con texto específico, foco visible y targets visibles de al menos 44 px |

En la revisión conceptual las cinco preguntas tienen una correspondencia directa: presupuesto/uso/restante en la tarjeta principal; saldo y cobertura en la tarjeta siguiente. Las aportaciones ya no sustituyen al presupuesto restante. No se ha realizado un estudio cronometrado con usuarios.

## Verificación visual

Chrome headless con perfil temporal aislado, componentes reales y CSS de producción; fixtures ficticias, sin credenciales ni escrituras sobre datos del usuario. Iframes con viewport efectivo de 320, 375, 768 y 1280 px; respetan el ancho de la barra lateral del layout.

32 combinaciones verificadas: normal, 80 %, exceso, faltante, presupuesto cero con gasto, importes de 9.000.000.000 €, presupuesto personal y mes preparado. Todas sin desbordamiento de página ni de contenido de tarjetas y sin targets visibles inferiores a 44 px. Se inspeccionó visualmente la captura móvil y se compactaron métricas y reordenó el aviso de preparación. Se corrigió un desbordamiento detectado en `ContributionBreakdown` sin recortar cifras.

Limitación: verificación en Chromium, no Safari/iPhone físico. La corrección previa de controles nativos de fecha se conserva sin cambios en esta fase.

## Pruebas y límites

- Verificación final: servidor **413 tests / 37 archivos**, incluyendo todas las integraciones opt-in de fases 2–5; `prisma:validate`, lint y `git diff --check` correctos. Cliente **298 tests / 43 archivos**, lint, build de producción y `git diff --check` correctos. Node 20.18.3.
- Incremento de esta fase: **72 tests backend y 31 frontend**; el Dashboard cuenta con 27 pruebas (se adaptaron las seis anteriores y se añadieron 21).
- Backend: 52 nuevas pruebas del cálculo puro, 14 de servicio/consultas y 6 HTTP/PostgreSQL; incluyen fechas límite y cambio diciembre/enero, scopes, márgenes, saldos actuales frente a snapshots, correcciones PAID/SKIPPED y presupuesto dinámico con planificación. Los tests de integración revierten sus datos incluso en caso de fallo.
- Se descubrió y corrigió el orden de actualización DETAIL → SUMMARY: eliminar las entries reemplazadas antes de cambiar el modo, en la misma transacción; el trigger de integridad se mantiene.
- Cliente: pruebas de jerarquía, estados, accesibilidad, contrato personal, importes grandes y refetch; pruebas de invalidación en flujos de pagos, variables, facturas, puntuales, cuentas y planificación.
- Los saldos se mantienen manualmente: no son una consulta al banco ni se actualizan automáticamente por registrar un gasto.
- Los puntuales no se descuentan como utilizados porque no hay mecanismo de pago; se explica en el desplegable. Los pagos plurimensuales se registran completos como utilizados en el mes, mientras su presupuesto recomendado sigue prorrateado.
- No se calcula un porcentaje ficticio frente a presupuesto cero ni un saldo personal desconocido. No se reconstruyen saldos bancarios históricos.
- En la comprobación final, `192.168.1.103:5173` no servía BudgetApp: el puerto 5173 estaba ocupado por otro proyecto. No se detuvo ni modificó ese proyecto.
