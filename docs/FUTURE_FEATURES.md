# Funcionalidades futuras

Este documento evita que funciones interesantes se introduzcan accidentalmente en el MVP antes de validar el recorrido principal.

## Importación de datos

- Importación manual desde CSV.
- Importación desde Excel.
- Mapeo asistido de columnas y vista previa antes de confirmar.
- Detección de duplicados e importaciones idempotentes.

No se implementa importación en las primeras fases. Los datos importados deberán pasar por los mismos servicios y validaciones que los creados desde formularios; nunca escribirán directamente en la caché o la base de datos.

## Automatización bancaria

- Importación automática bancaria.
- Conciliación de importes previstos con pagos reales.

Estas funciones no deben convertir BudgetApp en una aplicación de movimientos bancarios ni introducir múltiples cuentas en el MVP. El modelo inicial conserva un único saldo global conjunto por hogar.

## Documentos e inteligencia asistida

- OCR de facturas.
- Clasificación asistida por IA.
- Predicciones avanzadas basadas en históricos suficientes.

Las predicciones deberán explicar sus datos de entrada, mostrar incertidumbre y permitir corrección manual. Nunca sustituirán el presupuesto mensual estándar por una cifra dependiente solo de la fecha de simulación.

## Aplicaciones móviles

- Android.
- iOS.
- Cliente compartido o equivalente en React Native cuando el producto lo justifique.

La API permanece independiente del frontend web para que una futura aplicación móvil utilice los mismos contratos. La lógica financiera autoritativa continuará en el backend y no se duplicará en cada cliente.

## Criterios para incorporar una función

Antes de pasar una función a una fase activa debe definirse:

1. el problema de usuario que resuelve;
2. el contrato de API y permisos;
3. los estados vacío, carga, error, éxito y acceso limitado;
4. el comportamiento con datos incompletos o duplicados;
5. las pruebas de seguridad y cálculo necesarias;
6. una migración reversible cuando afecte al modelo de datos.
