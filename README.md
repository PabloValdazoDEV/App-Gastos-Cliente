# BudgetApp Cliente

Cliente web de presupuesto, previsión y planificación económica del hogar. La aplicación está orientada a responder una pregunta sencilla: cuánto conviene aportar cada mes para cubrir gastos habituales, variables y periódicos sin improvisar aportaciones extraordinarias.

Este repositorio contiene únicamente el frontend. La API vive en un repositorio independiente.

## Estado

El MVP web está conectado de extremo a extremo:

- React 19 y Vite 6 con JavaScript;
- Tailwind CSS 4 mediante el plugin oficial de Vite;
- React Router con layout responsive;
- TanStack React Query 5;
- cliente Axios con cookies, CSRF, timeout y refresh single-flight;
- estados base accesibles de carga, vacío, error, éxito y acceso limitado;
- Vitest y Testing Library;
- validación de variables públicas con Zod;
- registro, login local, logout, recuperación y cambio de contraseña;
- Google Login condicionado por configuración;
- sesión inicial, renovación single-flight, guards públicos/privados y gestión de sesiones activas;
- hogares, personas, reparto, día habitual, invitaciones y categorías configurables;
- recurrentes con márgenes, histórico y reglas de aviso; facturas históricas con documentos opcionales y variables en modo resumen o detalle;
- presupuesto, dashboard, preparación mensual, simulador y recuperación de déficit;
- calendario con estados reales, campana global, centro de notificaciones, preferencias y Web Push opcional.

## Requisitos

- Node.js `20.18.3` (definido en `.nvmrc`) o una versión compatible indicada en `package.json`;
- npm `10.8.2` o compatible;
- API de BudgetApp ejecutándose por separado para las funciones que consuman datos.

## Instalación

```bash
nvm use
npm install
cp .env.example .env
npm run dev
```

La aplicación se sirve por defecto en `http://localhost:5173`.

## Variables de entorno

Edita `.env` antes de iniciar la aplicación. Las tres variables mínimas son:

```env
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=BudgetApp
VITE_CSRF_COOKIE_NAME=csrf_token
```

Todas las variables `VITE_*` se incorporan al código enviado al navegador y, por tanto, son públicas. Consulta [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) para ver la referencia completa.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build optimizado en `dist/` |
| `npm run preview` | Previsualiza el build local |
| `npm run lint` | Ejecuta ESLint |
| `npm run lint:fix` | Corrige incidencias seguras de ESLint |
| `npm test` | Ejecuta la suite una vez |
| `npm run test:watch` | Ejecuta tests en modo interactivo |

## Rutas actuales

| Ruta | Propósito |
| --- | --- |
| `/login` | Inicio de sesión local y acceso opcional con Google |
| `/register` | Creación de cuenta |
| `/forgot-password` | Solicitud genérica de recuperación |
| `/reset-password` | Restablecimiento mediante token de un solo uso |
| `/auth/callback` | Resultado seguro del flujo Google OAuth |
| `/auth/google/link` | Confirmación segura al vincular Google con una cuenta local |
| `/invitaciones/aceptar` | Previsualización y aceptación segura de invitaciones |
| `/privacidad` | Política pública y metadatos dinámicos del responsable |
| `/dashboard` | Recomendación principal, saldo, reserva y próximo pago |
| `/presupuesto` | Desglose del estándar mensual y márgenes |
| `/gastos` | Entrada a los tres flujos de gasto |
| `/gastos/recurrentes` | Recurrentes, histórico y registro de pagos |
| `/gastos/recurrentes/:expenseId` | Enlace directo seguro a un recurrente desde una notificación |
| `/gastos/variables` | Meses variables en modo resumen o detalle |
| `/facturas` | Facturas por periodos reales, estadísticas y hasta cinco documentos opcionales |
| `/calendario` | Vencimientos por mes, 30/90 días o año |
| `/planificacion` | Preparación y financiación mensual |
| `/simulador` | Reserva a fecha y recuperación de déficit |
| `/hogar` | Personas, reparto, configuración e invitaciones |
| `/notificaciones` | Centro, preferencias y Web Push |
| `/ajustes` | Margen general y gestión de categorías y márgenes específicos |
| `/mas` | Agrupa destinos secundarios |
| `/mas/sesiones` | Cuenta, logout y sesiones activas |
| Cualquier otra | Página 404 con retorno al inicio |

La navegación inferior móvil contiene exactamente cinco destinos: Inicio, Gastos, Calendario, Planificación y Más.

En producción, el servidor estático debe redirigir rutas desconocidas a `index.html` para que enlaces directos como `/calendario` funcionen con React Router. No redirijas solicitudes de assets o API.

## Estructura

```text
src/
├── api/             Cliente HTTP, single-flight y query keys
├── app/             Providers, React Query, router y navegación
├── components/
│   ├── layout/      Shell responsive de la aplicación
│   └── ui/          Estados y componentes reutilizables
├── config/          Validación del entorno público
├── features/        Auth, hogar y servicios financieros
├── pages/           Páginas conectadas al router
├── styles/          Tokens semánticos y entrada de Tailwind
└── test/            Configuración común de Vitest
```

Las decisiones y límites se detallan en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Las funciones expresamente aplazadas están en [docs/FUTURE_FEATURES.md](docs/FUTURE_FEATURES.md).

## Comprobación antes de integrar

```bash
npm run lint
npm test
npm run build
```

No se guardan JWT ni refresh tokens en `localStorage`, `sessionStorage` o cookies accesibles desde JavaScript. La autenticación utiliza cookies `HttpOnly` emitidas por el servidor; JavaScript solo conserva temporalmente el token anti-CSRF no sensible.
