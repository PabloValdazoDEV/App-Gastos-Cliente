# Arquitectura frontend

## Estado del MVP

La aplicación incorpora autenticación, hogares, personas, gastos, presupuesto, planificación, calendario y notificaciones sobre datos reales de la API. Las integraciones Google, SMTP y Web Push son opcionales mediante flags de entorno.

## Capas

```text
Página / feature
      ↓
TanStack React Query
      ↓
Servicio de dominio
      ↓
http / apiClient
      ↓
API REST independiente
```

- `src/pages`: composición de pantallas y estados del recorrido.
- `src/features`: servicios, estado de hogar, queries, mutations, schemas y guards por dominio.
- `src/components`: piezas visuales reutilizables sin lógica de servidor.
- `src/app`: router, providers, navegación y configuración de caché.
- `src/api`: transporte HTTP y claves estables de React Query.
- `src/config`: lectura y validación de configuración pública.

Los servicios usan los helpers `http`. React Query coordina datos remotos, caché e invalidaciones; las páginas solo llaman `http` directamente en el módulo autocontenido de notificaciones.

## Estado y caché

TanStack React Query es la fuente de verdad para datos remotos. Las claves definidas en `src/api/queryKeys.js` cubren:

- `me`;
- `households`;
- `categories`;
- `dashboard`;
- `recurringExpenses`;
- `invoices`;
- `variableExpenses`;
- `monthlyPlanning`;
- `calendar`;
- `notifications`;
- `privacyPolicy`.

Los históricos de pagos y las reglas de recordatorio se anidan bajo la clave del recurrente. El contador global reutiliza la misma clave de notificaciones no leídas que el centro, de modo que marcar avisos actualiza también la campana sin duplicar estado.

Todas las claves dependientes de un hogar incluyen `householdId`, y las dependientes de un mes incluyen el periodo. Así se evita mezclar cachés entre hogares o simulaciones y se pueden invalidar únicamente los datos afectados.

El listado de facturas incluye solo `documentCount`. Los metadatos de los adjuntos se consultan al expandir una factura, evitando tanto una petición por cada fila como exponer nombres de archivos antes de que sean necesarios. Tras subir o eliminar un documento se invalidan su colección y el listado de facturas.

No se añade otra librería de estado: React Query gestiona servidor y un contexto pequeño conserva la selección de hogar. `localStorage` solo recuerda ese UUID; nunca guarda tokens.

## Cliente HTTP y sesión

`src/api/client.js` configura:

- `baseURL` validada desde `VITE_API_URL`;
- `withCredentials: true` para cookies seguras emitidas por la API;
- timeout de 10 segundos;
- cabecera `Accept: application/json`;
- token CSRF en `X-CSRF-Token` para `POST`, `PUT`, `PATCH` y `DELETE`;
- normalización a `ApiError` con `status`, `code`, `details` y `requestId`;
- desempaquetado del formato `{ "success": true, "data": ... }` en los helpers `http`.

Los access y refresh tokens permanecen en cookies `HttpOnly`; el cliente nunca los lee ni los persiste.

### Renovación single-flight

Ante un `401` de una ruta protegida:

```text
Peticiones A, B y C reciben 401
              ↓
      una sola petición /auth/refresh
              ↓
 A, B y C reintentan una vez con las nuevas cookies
```

Las rutas públicas de autenticación no intentan refresh. Cada petición original se marca antes de reintentarse para evitar bucles. Si la renovación falla, se emite `budgetapp:session-expired`; el boundary de sesión limpia React Query y redirige al login conservando el destino seguro al que el usuario intentaba acceder.

### Contrato CSRF

El servidor entrega una cookie legible configurable y valida `X-CSRF-Token` más el origen. La cookie contiene solo el token anti-CSRF; no contiene JWT.

## Entorno público

`src/config/parsePublicEnv.js` concentra el schema compartido por Vite y `src/config/env.js`; valida al compilar y al arrancar:

- URL de API válida;
- nombre de aplicación no vacío;
- flags booleanas escritas como `true` o `false`;
- credenciales públicas asociadas cuando una integración está habilitada.

La aplicación falla con un mensaje que enumera la variable incorrecta en lugar de ejecutarse parcialmente configurada.

## Router y navegación

El layout comparte un único contenido principal, enlace de salto y foco visible. En móvil hay exactamente cinco destinos persistentes. Las opciones secundarias se agrupan en “Más” para evitar nueve iconos al mismo nivel.

El router se mantiene declarativo y sin loaders de datos. `PublicOnly` aparta de login a quien ya tiene sesión y `RequireAuth` protege toda la aplicación privada. La consulta `me` es la única fuente de verdad remota de identidad. Las páginas se cargan bajo demanda y los datos remotos pertenecen a React Query.

## Sistema visual y accesibilidad

Los tokens semánticos de color, sombra y tipografía viven en `src/styles/index.css` y se exponen a Tailwind mediante `@theme inline`. Esto evita repetir valores y deja preparado un posible tema oscuro sin implementarlo en el MVP.

La base incluye:

- layout mobile-first sin scroll horizontal;
- targets táctiles de al menos 44 px en las acciones principales;
- navegación con icono y etiqueta persistente;
- jerarquía de encabezados;
- enlace para saltar al contenido;
- foco visible;
- mensajes que no dependen solo del color;
- soporte para reducción de movimiento;
- componentes de carga, vacío, error, éxito y permiso restringido.

Sin hogar o sin reparto válido, las pantallas explican qué falta y no inventan importes. Con datos, todo el cálculo mostrado procede de la API.

## Formularios de autenticación

React Hook Form, Zod y `@hookform/resolvers` validan antes de enviar. Todos los campos conservan label, ayuda o error asociado y autocompletado semántico. Registro y reset comparten la política de contraseña; login solo exige una contraseña no vacía para no impedir el acceso a cuentas antiguas. La confirmación de contraseña nunca se envía a la API.

### Privacidad en el alta

`GET /api/legal/privacy-policy` es público y aporta la versión, fecha efectiva y datos del responsable. `/privacidad` también es pública, incluso con una sesión activa, y presenta una primera capa resumida y una segunda capa detallada. Si la política no está configurada o no puede cargarse, el registro queda bloqueado con una explicación y una acción de reintento.

El formulario mantiene la casilla desmarcada y separada de la información básica. La API recibe `privacyPolicyAcknowledged: true` y la `privacyPolicyVersion` mostrada; no se envía la confirmación de contraseña. Si la versión cambia, se limpia la confirmación y se vuelve a consultar el documento.

Cuando Google está habilitado, el login de cuentas existentes conserva su URL sin aceptación. La acción independiente «Crear cuenta con Google» solo se habilita después de confirmar la política y añade aceptación y versión a `/auth/google/start`. Los códigos de política no configurada, confirmación ausente y versión obsoleta se traducen a mensajes accionables.

El contenido legal evita presumir proveedores, transferencias, plazos de eliminación o bases jurídicas que el despliegue no haya documentado. La configuración de producción debe completar esos extremos; la interfaz no sustituye esa revisión.

## Documentos de factura

Cada factura admite opcionalmente hasta cinco documentos PDF, JPEG, PNG o WebP de 10 MiB como máximo por archivo. La selección se valida en cliente para dar feedback inmediato, pero la validación de tipo, firma, tamaño, permisos y límites del servidor sigue siendo la autoridad.

La subida envía un único `File` crudo por petición con su `Content-Type`; no utiliza `multipart/form-data`. El nombre codificado viaja en `X-Document-Filename`, no en la URL, para evitar que quede en logs de proxy. Si un proveedor móvil omite el MIME, el cliente solo lo infiere de una extensión permitida. La descarga obtiene el contenido autenticado como `blob`, crea un enlace temporal con atributo `download` y revoca su URL después de un margen seguro. El archivo no se renderiza como contenido confiable del origen frontend. El borrado exige confirmación y no elimina la factura.

No hay variables de entorno frontend nuevas para esta función. El almacenamiento y sus políticas pertenecen al backend y a la infraestructura de producción.

## Decisiones aplazadas

- Reparto por cantidad fija: el modelo lo prepara, pero el MVP financiero usa porcentajes.
- Importación CSV y OCR.
- Tema oscuro: preparado mediante tokens, no implementado.
- Gráficos: no se añade una librería hasta que una visualización aporte claridad real.
