import {
  ArrowLeft,
  CircleDollarSign,
  ExternalLink,
  Mail,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { publicEnv } from '../config/env';
import { usePrivacyPolicyQuery } from '../features/legal/privacyPolicyQueries';

const policySections = [
  ['responsable', 'Responsable y contacto'],
  ['finalidades', 'Finalidades'],
  ['categorias', 'Categorías de datos'],
  ['bases', 'Bases jurídicas'],
  ['destinatarios', 'Destinatarios y proveedores'],
  ['transferencias', 'Transferencias internacionales'],
  ['conservacion', 'Conservación'],
  ['derechos', 'Tus derechos y la AEPD'],
  ['seguridad', 'Seguridad'],
  ['decisiones', 'Cálculos y decisiones automatizadas'],
  ['menores', 'Menores'],
  ['cambios', 'Cambios y versión'],
];

function formatEffectiveDate(value) {
  if (typeof value !== 'string' || !value) return 'No indicada';

  const date = new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date);
}

function PolicySection({ children, id, title }) {
  return (
    <section aria-labelledby={`${id}-title`} className="scroll-mt-6" id={id}>
      <h2 className="text-xl font-extrabold tracking-tight text-text" id={`${id}-title`}>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-text-muted sm:text-base">
        {children}
      </div>
    </section>
  );
}

function BulletList({ children }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-brand">{children}</ul>;
}

function PrivacyShell({ children }) {
  return (
    <div className="min-h-dvh bg-background text-text">
      <a
        className="fixed left-3 top-3 z-50 -translate-y-24 rounded-lg bg-brand px-4 py-3 text-sm font-bold text-on-brand shadow-lg transition-transform focus:translate-y-0 focus:outline-2 focus:outline-offset-2 focus:outline-focus"
        href="#contenido-privacidad"
      >
        Saltar al contenido de privacidad
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            aria-label={`${publicEnv.appName}, ir al inicio`}
            className="flex min-h-11 items-center gap-2 rounded-lg font-extrabold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            to="/"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-on-brand">
              <CircleDollarSign aria-hidden="true" className="size-5" />
            </span>
            {publicEnv.appName}
          </Link>
          <Link
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            to="/register"
          >
            Crear cuenta
          </Link>
        </div>
      </header>
      <main
        className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
        id="contenido-privacidad"
        tabIndex="-1"
      >
        {children}
      </main>
    </div>
  );
}

export function PrivacyPage() {
  const policy = usePrivacyPolicyQuery();

  useEffect(() => {
    document.title = `Política de privacidad · ${publicEnv.appName}`;
  }, []);

  if (policy.isPending) {
    return (
      <PrivacyShell>
        <LoadingState label="Cargando Política de privacidad" />
      </PrivacyShell>
    );
  }

  if (policy.isError) {
    return (
      <PrivacyShell>
        <ErrorState
          description="No se han podido obtener la versión y los datos del responsable. Reintenta la carga antes de usar esta información."
          onRetry={policy.refetch}
          title="No podemos cargar la Política de privacidad"
        />
      </PrivacyShell>
    );
  }

  const metadata = policy.data;
  const controller = metadata.controller ?? {};
  const policyConfigured = metadata.configured && Boolean(metadata.version);

  return (
    <PrivacyShell>
      <Link
        className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        to="/register"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Volver al registro
      </Link>

      <header className="mt-5 max-w-3xl">
        <p className="text-sm font-bold text-brand-strong">Información sobre tus datos</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Política de privacidad
        </h1>
        <p className="mt-4 text-base leading-7 text-text-muted">
          Aquí explicamos qué datos necesita {publicEnv.appName}, para qué los utiliza y cómo puedes ejercer tus derechos. La información se presenta primero de forma resumida y después con más detalle.
        </p>
      </header>

      {!policyConfigured ? (
        <section
          className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
          role="alert"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            <h2 className="font-bold">Política todavía no publicada</h2>
            <p className="mt-1 text-sm leading-6">
              Faltan la versión o datos obligatorios del responsable. El contenido siguiente sirve para explicar el tratamiento previsto, pero el registro permanecerá bloqueado hasta completar la configuración legal.
            </p>
          </div>
        </section>
      ) : null}

      <dl className="mt-6 grid gap-3 rounded-2xl border border-border bg-surface p-5 shadow-card sm:grid-cols-3">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-text-soft">Versión</dt>
          <dd className="mt-1 font-extrabold">{metadata.version ?? 'No indicada'}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-text-soft">Fecha efectiva</dt>
          <dd className="mt-1 font-extrabold">{formatEffectiveDate(metadata.effectiveDate)}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-text-soft">Responsable</dt>
          <dd className="mt-1 font-extrabold">{controller.name ?? 'No configurado'}</dd>
        </div>
      </dl>

      <section
        aria-labelledby="resumen-privacidad"
        className="mt-8 rounded-3xl bg-brand-deep p-5 text-on-brand shadow-elevated sm:p-7"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
          <div>
            <h2 className="text-xl font-extrabold" id="resumen-privacidad">Resumen esencial</h2>
            <p className="mt-3 text-sm leading-7 text-on-brand-muted sm:text-base">
              Tratamos los datos necesarios para crear y proteger tu cuenta, organizar hogares compartidos y calcular presupuestos, reservas y previsiones. Compartimos información solo con quienes tengan acceso al mismo hogar, con proveedores técnicamente necesarios cuando estén configurados o cuando lo exija la ley.
            </p>
            <p className="mt-3 text-sm leading-7 text-on-brand-muted sm:text-base">
              Puedes ejercer tus derechos ante el responsable. Los cálculos financieros son orientativos: no sustituyen asesoramiento profesional ni producen por sí solos efectos jurídicos.
            </p>
          </div>
        </div>
      </section>

      <nav
        aria-label="Contenido de la Política de privacidad"
        className="mt-8 rounded-2xl border border-border bg-surface p-5"
      >
        <h2 className="font-extrabold">Consulta por tema</h2>
        <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {policySections.map(([id, label]) => (
            <li key={id}>
              <a
                className="inline-flex min-h-11 items-center text-sm font-bold text-brand-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                href={`#${id}`}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <article className="mt-10 space-y-10">
        <PolicySection id="responsable" title="Responsable y contacto">
          <p>El responsable del tratamiento es quien decide cómo y para qué se utilizan tus datos.</p>
          <address className="rounded-2xl bg-surface-muted p-4 not-italic">
            <p><strong className="text-text">Responsable:</strong> {controller.name ?? 'No configurado'}</p>
            {controller.address ? (
              <p><strong className="text-text">Dirección:</strong> {controller.address}</p>
            ) : null}
            <p>
              <strong className="text-text">Contacto de privacidad:</strong>{' '}
              {controller.contactEmail ? (
                <a className="font-bold text-brand-strong underline" href={`mailto:${controller.contactEmail}`}>
                  {controller.contactEmail}
                </a>
              ) : 'No configurado'}
            </p>
            {controller.dpoEmail ? (
              <p>
                <strong className="text-text">Delegado de protección de datos:</strong>{' '}
                <a className="font-bold text-brand-strong underline" href={`mailto:${controller.dpoEmail}`}>
                  {controller.dpoEmail}
                </a>
              </p>
            ) : null}
          </address>
        </PolicySection>

        <PolicySection id="finalidades" title="Finalidades del tratamiento">
          <BulletList>
            <li>Crear, autenticar y proteger tu cuenta y sus sesiones.</li>
            <li>Permitir crear hogares, representar a sus participantes y gestionar accesos e invitaciones.</li>
            <li>Registrar los datos financieros que introduces y ofrecer presupuestos, planificación mensual, calendarios, reservas teóricas, simulaciones y planes de recuperación.</li>
            <li>Enviar avisos operativos y recordatorios cuando esas funciones estén configuradas y habilitadas.</li>
            <li>Prevenir abuso, investigar fallos, mantener la seguridad y cumplir obligaciones legales.</li>
          </BulletList>
        </PolicySection>

        <PolicySection id="categorias" title="Categorías de datos">
          <BulletList>
            <li>Identificación y contacto: nombre, email y datos de acceso vinculados a tu cuenta.</li>
            <li>Cuenta y seguridad: sesiones, fechas de uso, agente de usuario y constancia de la versión de privacidad confirmada, su fecha y el origen del alta. La IP en claro puede procesarse transitoriamente para seguridad y límites de uso; en los registros persistentes de sesión y auditoría se guarda una huella HMAC seudonimizada, no la IP en claro.</li>
            <li>Hogar: nombre del hogar, participantes —incluidos nombres o emails de terceras personas que introduzcas—, porcentajes, roles, invitaciones y preferencias compartidas.</li>
            <li>Información financiera introducida por las personas usuarias: gastos, facturas, importes, comercios, saldos globales, fechas, notas, planificaciones y previsiones. Puedes adjuntar opcionalmente documentos PDF o imágenes a una factura; se tratan su contenido, nombre, tipo, tamaño, fecha y persona que lo subió. Las imágenes pueden conservar metadatos EXIF sobre dispositivo, fecha o ubicación: la aplicación no los elimina, por lo que debes retirarlos antes si no son necesarios. La versión actual no se conecta a cuentas bancarias ni importa movimientos automáticamente.</li>
            <li>Preferencias de notificación. Si la entrega por email está configurada, los recordatorios pueden quedar activos por defecto según la preferencia y el gasto; push exige permiso y suscripción del navegador y guarda endpoint, claves técnicas, agente de usuario y contenido operativo del aviso, que puede incluir nombre del gasto, importe previsto y ruta interna.</li>
            {publicEnv.enableGoogleLogin ? (
              <li>Google, como proveedor opcional de identidad, facilita identificador, email y perfil básico solicitado mediante los alcances openid, email y profile cuando eliges ese acceso.</li>
            ) : (
              <li>Datos básicos facilitados por un proveedor de identidad, solo si el responsable configura esa integración y eliges utilizarla.</li>
            )}
            <li>Datos del navegador: identificador del hogar seleccionado en almacenamiento local y, durante ciertos retornos de autenticación, una ruta interna que puede contener temporalmente un token de invitación en almacenamiento de sesión.</li>
            <li>Evidencias legales y auditoría: versión de política confirmada, fecha, origen del alta y eventos de cambios relevantes; los metadatos de auditoría pueden incluir campos financieros necesarios para explicar la operación.</li>
          </BulletList>
          <p>Evita incluir categorías especiales de datos u otra información sensible que no sea necesaria en notas, conceptos, perfiles de terceras personas o documentos adjuntos.</p>
        </PolicySection>

        <PolicySection id="bases" title="Bases jurídicas">
          <p>La prestación de las funciones que solicitas y la gestión de tu cuenta se prevén sobre la ejecución de la relación de servicio. El responsable debe confirmar y documentar esta base, así como cualquier obligación legal aplicable, antes de publicar la política definitiva.</p>
          <p>La protección de cuentas, prevención del abuso y mejora de la fiabilidad solo podrán apoyarse en interés legítimo si el responsable realiza y documenta la ponderación correspondiente. Las funciones opcionales que legalmente requieran consentimiento deberán solicitarlo de forma específica.</p>
          <p><strong className="text-text">La casilla del registro acredita que has recibido y leído esta información.</strong> No convierte por sí sola todos los tratamientos en tratamientos basados en consentimiento.</p>
        </PolicySection>

        <PolicySection id="destinatarios" title="Destinatarios y proveedores necesarios">
          <p>Las personas activas con acceso autorizado al mismo hogar pueden consultar y, con las funciones actuales, modificar la información financiera compartida necesaria para colaborar. Esto incluye descargar y eliminar los documentos asociados a facturas. Antes de invitar a alguien, revisa qué datos del hogar podrá consultar y modificar.</p>
          <p>Cuando estén configurados, podrán intervenir proveedores técnicamente necesarios por categorías —por ejemplo, alojamiento y base de datos, entrega de correo, notificaciones push o identidad federada—. Antes de operar en producción, el responsable debe identificarlos, determinar su rol y formalizar los contratos y garantías que resulten exigibles. El envío de correo requiere facilitar al proveedor de entrega el email, el nombre y el mensaje; push requiere los datos técnicos de suscripción y el contenido operativo del aviso. Esta política no atribuye el servicio a un proveedor concreto que no haya sido identificado por el responsable.</p>
          {publicEnv.enableGoogleLogin ? <p>La integración opcional de identidad configurada en este frontend es Google. Su uso solo se produce si eliges expresamente esa vía de acceso o registro.</p> : null}
          <p>También podrán comunicarse datos a administraciones, tribunales o autoridades cuando exista una obligación legal válida.</p>
        </PolicySection>

        <PolicySection id="transferencias" title="Transferencias internacionales">
          <p>No se presume que existan transferencias internacionales. Pueden producirse únicamente si un proveedor necesario seleccionado por el responsable trata datos fuera del Espacio Económico Europeo.</p>
          <p>En ese caso, el responsable deberá identificar el proveedor y aplicar el mecanismo válido correspondiente —como una decisión de adecuación o garantías contractuales— e informar de cómo obtener una copia o consultar esas garantías.</p>
        </PolicySection>

        <PolicySection id="conservacion" title="Conservación de los datos">
          <p>Los datos de cuenta y del hogar se conservan mientras resultan necesarios para prestar el servicio y mantener su histórico. Archivar un hogar, una persona o un gasto no equivale a borrarlo: esos registros se conservan para mantener cálculos, trazabilidad y relaciones históricas.</p>
          <p>La versión actual no ofrece una función autoservicio para borrar la cuenta o exportar todos los datos. Puedes ejercer los derechos aplicables mediante el contacto del responsable; cada solicitud deberá resolverse según la finalidad, las obligaciones legales, la seguridad, la auditoría y posibles reclamaciones.</p>
          <p>La constancia de la versión de privacidad confirmada se mantiene como registro de responsabilidad y trazabilidad y no se modifica mediante las operaciones ordinarias de la aplicación.</p>
          <p>Tokens temporales, invitaciones y sesiones tienen una vigencia de uso limitada por su configuración, pero esa caducidad no implica necesariamente que sus filas se borren de inmediato. Los plazos de eliminación de registros, logs y copias de seguridad dependen de la infraestructura y deberán documentarse cuando quede configurada.</p>
          <p>La constancia de esta confirmación no tiene actualmente una depuración automática. El responsable debe definir y justificar su plazo y resolverla junto con cualquier solicitud de supresión; no se presupone una retención indefinida.</p>
          <p>Los documentos adjuntos se conservan mientras permanecen asociados a la factura. La acción de eliminar un adjunto lo retira del almacenamiento activo y de la vista del hogar, pero los plazos aplicables a copias de seguridad o registros técnicos dependen de la infraestructura y deben documentarse antes de producción.</p>
        </PolicySection>

        <PolicySection id="derechos" title="Tus derechos y la AEPD">
          <p>Puedes solicitar acceso, rectificación, supresión, limitación, oposición y portabilidad cuando resulten aplicables. También puedes retirar un consentimiento sin afectar a la licitud previa y oponerte a decisiones individuales automatizadas.</p>
          <p>Dirige tu solicitud al contacto de privacidad indicado arriba, explicando qué derecho quieres ejercer. Puede ser necesario verificar tu identidad de forma proporcionada. Como no existe todavía un panel de exportación o borrado de cuenta, este contacto es el canal para solicitar esas actuaciones.</p>
          <p>
            Si consideras que no se han respetado tus derechos, puedes consultar cómo ejercerlos o presentar una reclamación ante la{' '}
            <a
              className="inline-flex items-center gap-1 font-bold text-brand-strong underline underline-offset-4"
              href="https://www.aepd.es/derechos-y-deberes/ejerce-tus-derechos"
              rel="noreferrer"
              target="_blank"
            >
              Agencia Española de Protección de Datos
              <ExternalLink aria-hidden="true" className="size-4" />
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>.
          </p>
        </PolicySection>

        <PolicySection id="seguridad" title="Seguridad">
          <p>El servicio aplica controles de acceso por hogar y rol, tokens de sesión en cookies HttpOnly, una cookie anti-CSRF legible por el cliente, validación de entradas, límites de uso y registros de auditoría donde corresponda. Algunos flujos de identidad utilizan además cookies temporales.</p>
          <p>En los adjuntos se limitan formatos, tamaño, número y firma del archivo, pero la versión actual no aplica OCR, análisis mediante inteligencia artificial ni análisis antivirus. Descarga y revisa los archivos con las medidas de seguridad de tu dispositivo.</p>
          <p>Ninguna medida elimina por completo el riesgo. Si detectas acceso no autorizado o una exposición de datos, comunícalo cuanto antes al contacto de privacidad.</p>
        </PolicySection>

        <PolicySection id="decisiones" title="Cálculos y decisiones automatizadas">
          <p>Presupuestos, reservas, alertas, simulaciones y previsiones se calculan automáticamente a partir de los datos que introduces y de reglas financieras visibles en el producto.</p>
          <p><strong className="text-text">Estos resultados son orientativos y no constituyen asesoramiento financiero.</strong> No producen efectos jurídicos ni decisiones vinculantes sobre ti; tú decides si utilizarlos y debes revisar los datos de partida.</p>
        </PolicySection>

        <PolicySection id="menores" title="Menores">
          <p>La versión actual no solicita la edad ni incorpora una barrera técnica o verificación específica para menores. El responsable debe decidir y publicar la edad mínima y el procedimiento de autorización aplicable antes de ofrecer el servicio a menores.</p>
          <p>Si una persona menor se representa dentro de un hogar para realizar cálculos, debe evitarse introducir información innecesaria. Quien ejerza la responsabilidad parental o tutela puede contactar con el responsable si considera que se han tratado datos de un menor de forma inadecuada.</p>
        </PolicySection>

        <PolicySection id="cambios" title="Cambios y versión">
          <p>La versión vigente es <strong className="text-text">{metadata.version ?? 'no indicada'}</strong> y su fecha efectiva es <strong className="text-text">{formatEffectiveDate(metadata.effectiveDate)}</strong>.</p>
          <p>Si el tratamiento cambia de forma relevante, deberá publicarse una nueva versión y comunicarse por un medio adecuado. El registro de nuevas cuentas exige confirmar la versión vigente; la implementación actual no solicita automáticamente una nueva confirmación a cuentas ya existentes. Si un cambio requiere nueva confirmación o consentimiento, habrá que habilitar ese mecanismo antes de aplicar el tratamiento.</p>
        </PolicySection>
      </article>

      <footer className="mt-12 border-t border-border pt-6 text-sm text-text-muted">
        <p className="flex items-start gap-2">
          <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Para consultas de privacidad, utiliza {controller.contactEmail ? (
            <a className="font-bold text-brand-strong underline" href={`mailto:${controller.contactEmail}`}>{controller.contactEmail}</a>
          ) : 'el contacto del responsable cuando esté configurado'}.
        </p>
      </footer>
    </PrivacyShell>
  );
}
