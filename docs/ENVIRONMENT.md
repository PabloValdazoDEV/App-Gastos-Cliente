# Variables de entorno del frontend

## Uso local

```bash
cp .env.example .env
```

Después, ajusta `.env` para tu entorno. Vite expone al navegador cualquier variable cuyo nombre empiece por `VITE_`. Ninguna de estas variables puede tratarse como un secreto.

## Referencia

| Variable | Obligatoria | Ejemplo de desarrollo | Contenido secreto | Descripción |
| --- | --- | --- | --- | --- |
| `VITE_API_URL` | Sí | `/api` | No | URL absoluta o ruta del mismo origen para la API REST, incluido el prefijo `/api` |
| `VITE_CSRF_COOKIE_NAME` | Sí | `csrf_token` | No | Nombre público de la cookie double-submit; debe coincidir con `CSRF_COOKIE_NAME` del servidor |
| `VITE_APP_NAME` | Sí | `BudgetApp` | No | Nombre visible de la aplicación |
| `VITE_ENABLE_GOOGLE_LOGIN` | No | `false` | No | Muestra “Continuar con Google”; el backend también debe tener OAuth configurado |
| `VITE_VAPID_PUBLIC_KEY` | Solo si Web Push está activo | Vacío mientras esté desactivado | No | Clave VAPID pública para suscripciones push |
| `VITE_ENABLE_WEB_PUSH` | No | `false` | No | Habilita funciones Web Push cuando se implementen |

Las flags solo aceptan literalmente `true` o `false`. Si falta una variable obligatoria o se habilita una integración sin su valor público asociado, tanto el build como el arranque fallan con un error que identifica la variable. El acceso con Google no necesita una credencial en el frontend: el navegador inicia el flujo en el servidor, que conserva el Client ID y el Client Secret.

## Configuración mínima de desarrollo

```env
VITE_API_URL=/api
VITE_CSRF_COOKIE_NAME=csrf_token
VITE_APP_NAME=BudgetApp
VITE_ENABLE_GOOGLE_LOGIN=false
VITE_VAPID_PUBLIC_KEY=
VITE_ENABLE_WEB_PUSH=false
```

## Configuración de producción

- Usa siempre HTTPS para la aplicación y la API.
- Define `VITE_API_URL` con `/api` si frontend y API comparten origen, o con la URL pública exacta de la API si se sirven por separado.
- Configura CORS y las cookies en el servidor para el origen real del cliente.
- Activa una feature únicamente cuando la integración y sus valores públicos estén listos.
- Genera un build nuevo después de cambiar variables: Vite las incorpora durante la compilación.

## Valores que nunca deben aparecer aquí

No añadas a `.env` del frontend:

- `DATABASE_URL`;
- JWT access o refresh secrets;
- JWT o refresh tokens;
- Google client secret;
- contraseñas SMTP;
- clave VAPID privada;
- secretos CSRF;
- claves privadas o API keys usadas como mecanismo de autorización.

Esos valores pertenecen exclusivamente al entorno del servidor. `.env` está ignorado por Git y `.env.example` solo contiene ejemplos públicos sin credenciales reales.

## Añadir otra variable

1. Añádela primero a `.env.example` con un valor seguro.
2. Documenta finalidad, obligatoriedad y sensibilidad en este archivo.
3. Valídala en `src/config/parsePublicEnv.js`.
4. Expón desde `publicEnv` únicamente el valor que necesite la aplicación.
5. Añade o actualiza sus tests.
