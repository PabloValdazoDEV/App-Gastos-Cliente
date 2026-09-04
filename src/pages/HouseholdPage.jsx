import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Copy,
  House,
  Link2,
  MailPlus,
  Settings2,
  UserPlus,
  UsersRound,
  WalletCards,
  Trash2,
} from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { queryKeys } from '../api/queryKeys';
import { EmptyState } from '../components/ui/EmptyState';
import {
  ErrorState,
  LoadingState,
  RestrictedState,
  SuccessNotice,
} from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { AuthError } from '../features/auth/components/AuthFeedback';
import { FormField } from '../features/auth/components/FormField';
import { householdService } from '../features/households/householdService';
import { useHousehold } from '../features/households/useHousehold';
import { ConfirmationDialog } from './expensePageShared';

const primaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-on-brand shadow-sm transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-bold text-text transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';
const inputClass =
  'min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-base text-text shadow-sm outline-none transition-colors placeholder:text-text-soft focus:border-brand focus:ring-3 focus:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted';

const roleLabels = Object.freeze({
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  MEMBER: 'Miembro',
});

const invitationStatusLabels = Object.freeze({
  ACCEPTED: 'Aceptada',
  EXPIRED: 'Caducada',
  PENDING: 'Pendiente',
  REVOKED: 'Revocada',
});

function percentToBps(value) {
  const normalized = String(value).trim().replace(',', '.');
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Introduce un porcentaje con un máximo de dos decimales.');
  }

  const percentage = Number(normalized);
  if (percentage < 0 || percentage > 100) {
    throw new Error('El porcentaje debe estar entre 0 % y 100 %.');
  }

  return Math.round(percentage * 100);
}

function bpsToPercent(value) {
  if (!Number.isInteger(value)) return '0';
  return String(value / 100).replace('.', ',');
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date);
}

function SectionHeading({ description, icon: Icon, title }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold tracking-tight text-text">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-text-muted">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function HouseholdOnboarding({ householdState }) {
  const queryClient = useQueryClient();
  const [householdName, setHouseholdName] = useState('');
  const [personName, setPersonName] = useState('');
  const mutation = useMutation({
    mutationFn: householdService.create,
    onSuccess: async (household) => {
      householdState.selectHousehold(household.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.households.all() });
      await householdState.refetch();
      toast.success('Tu hogar ya está listo para añadir gastos.');
    },
  });

  function handleSubmit(event) {
    event.preventDefault();
    mutation.mutate({
      name: householdName.trim(),
      contributionMode: 'PERCENTAGE',
      people: [
        {
          name: personName.trim(),
          contributionBps: 10000,
          isActive: true,
          linkCurrentUser: true,
        },
      ],
    });
  }

  return (
    <EmptyState
      action={
        <form className="max-w-xl space-y-5" onSubmit={handleSubmit}>
          <FormField
            autoComplete="organization"
            label="Nombre del hogar"
            maxLength={120}
            name="householdName"
            onChange={(event) => setHouseholdName(event.target.value)}
            placeholder="Ej. Casa familiar"
            required
            value={householdName}
          />
          <FormField
            autoComplete="name"
            help="Esta persona participará inicialmente con el 100 %. Después podrás añadir más y repartirlo de otra forma."
            label="Tu nombre dentro del reparto"
            maxLength={120}
            name="personName"
            onChange={(event) => setPersonName(event.target.value)}
            placeholder="Ej. Alex"
            required
            value={personName}
          />
          <button
            className={`${primaryButton} w-full sm:w-auto`}
            disabled={mutation.isPending}
            type="submit"
          >
            <House aria-hidden="true" className="size-5" />
            {mutation.isPending ? 'Creando hogar…' : 'Crear hogar y empezar'}
          </button>
          <AuthError error={mutation.error} />
        </form>
      }
      description="Solo necesitamos un nombre para el hogar y una primera persona. Crearemos las categorías habituales y un reparto válido del 100 %."
      icon={House}
      title="Crea tu primer hogar"
    />
  );
}

function HouseholdSelector({ householdState }) {
  if (householdState.households.length < 2) return null;

  return (
    <div className="max-w-sm">
      <label className="mb-1.5 block text-sm font-bold text-text" htmlFor="household-selector">
        Hogar que estás gestionando
      </label>
      <select
        className={inputClass}
        id="household-selector"
        onChange={(event) => householdState.selectHousehold(event.target.value)}
        value={householdState.currentHousehold.id}
      >
        {householdState.households.map((household) => (
          <option key={household.id} value={household.id}>
            {household.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function HouseholdSummary({ household }) {
  return (
    <section
      aria-labelledby="household-summary-title"
      className="overflow-hidden rounded-3xl bg-brand-deep p-5 text-on-brand shadow-elevated sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-on-brand-muted">Hogar actual</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight" id="household-summary-title">
            {household.name}
          </h2>
        </div>
        <span className="rounded-full border border-on-brand/20 bg-on-brand/10 px-3 py-1 text-xs font-bold">
          {roleLabels[household.access?.role] ?? 'Miembro'}
        </span>
      </div>
      <dl className="mt-6 grid gap-3 min-[430px]:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-on-brand/10 p-4">
          <dt className="text-xs font-semibold text-on-brand-muted">Moneda</dt>
          <dd className="mt-1 font-extrabold">{household.currency}</dd>
        </div>
        <div className="rounded-2xl bg-on-brand/10 p-4">
          <dt className="text-xs font-semibold text-on-brand-muted">Margen general</dt>
          <dd className="mt-1 font-extrabold">
            {household.safetyMarginBps === 0 ? 'Sin margen' : `${household.safetyMarginBps / 100} %`}
          </dd>
        </div>
        <div className="rounded-2xl bg-on-brand/10 p-4">
          <dt className="text-xs font-semibold text-on-brand-muted">Tipo de reparto</dt>
          <dd className="mt-1 font-extrabold">
            {household.contributionMode === 'FIXED' ? 'Porcentaje pendiente de revisar' : 'Porcentaje'}
          </dd>
        </div>
        <div className="rounded-2xl bg-on-brand/10 p-4">
          <dt className="text-xs font-semibold text-on-brand-muted">Día de aportación</dt>
          <dd className="mt-1 font-extrabold">Día {household.contributionDay ?? 1}</dd>
        </div>
      </dl>
    </section>
  );
}

function HouseholdSettings({ household, canManage }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(household.name);
  const [margin, setMargin] = useState(bpsToPercent(household.safetyMarginBps));
  const [withoutMargin, setWithoutMargin] = useState(household.safetyMarginBps === 0);
  const [contributionDay, setContributionDay] = useState(
    String(household.contributionDay ?? 1),
  );
  const [validationError, setValidationError] = useState('');
  const [contributionDayError, setContributionDayError] = useState('');
  const mutation = useMutation({
    mutationFn: householdService.update,
    onSuccess: (updated) => {
      queryClient.setQueryData(
        queryKeys.households.detail(household.id),
        (current) => ({
          ...current,
          ...updated,
          access: current?.access ?? household.access,
        }),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.households.all() });
      toast.success('Configuración del hogar guardada.');
    },
  });

  useEffect(() => {
    setName(household.name);
    setMargin(bpsToPercent(household.safetyMarginBps));
    setWithoutMargin(household.safetyMarginBps === 0);
    setContributionDay(String(household.contributionDay ?? 1));
    setValidationError('');
    setContributionDayError('');
  }, [
    household.contributionDay,
    household.id,
    household.name,
    household.safetyMarginBps,
  ]);

  if (!canManage) return null;

  function handleSubmit(event) {
    event.preventDefault();
    try {
      const safetyMarginBps = withoutMargin ? 0 : percentToBps(margin);
      const parsedContributionDay = Number(contributionDay);

      if (
        !/^\d{1,2}$/.test(contributionDay) ||
        !Number.isInteger(parsedContributionDay) ||
        parsedContributionDay < 1 ||
        parsedContributionDay > 31
      ) {
        throw new RangeError('El día habitual debe estar entre 1 y 31.');
      }

      setValidationError('');
      setContributionDayError('');
      mutation.mutate({
        householdId: household.id,
        body: {
          contributionDay: parsedContributionDay,
          name: name.trim(),
          safetyMarginBps,
        },
      });
    } catch (error) {
      if (error instanceof RangeError) {
        setContributionDayError(error.message);
      } else {
        setValidationError(error.message);
      }
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <SectionHeading
        description="El margen se mostrará por separado en los cálculos; no queda escondido dentro del presupuesto."
        icon={Settings2}
        title="Configuración básica"
      />
      <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
        <FormField
          label="Nombre del hogar"
          maxLength={120}
          name="settingsName"
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
        <FormField
          error={validationError}
          help="10 equivale a un margen del 10 %."
          inputMode="decimal"
          label="Margen general (%)"
          name="settingsMargin"
          onChange={(event) => setMargin(event.target.value)}
          placeholder="10"
          required={!withoutMargin}
          value={margin}
        />
        <label className="flex min-h-12 items-start gap-3 rounded-xl bg-surface-muted px-3.5 py-3 text-sm text-text sm:col-span-2">
          <input
            checked={withoutMargin}
            className="mt-0.5 size-4 accent-brand"
            onChange={(event) => setWithoutMargin(event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="block font-bold">Sin margen de seguridad</span>
            <span className="mt-0.5 block text-xs leading-5 text-text-muted">El presupuesto usará exactamente el importe previsto.</span>
          </span>
        </label>
        <FormField
          error={contributionDayError}
          help="Antes de este día, un mes sin preparar se mostrará como pendiente, no como déficit."
          inputMode="numeric"
          label="Día habitual de aportación"
          max="31"
          min="1"
          name="settingsContributionDay"
          onChange={(event) => {
            setContributionDay(event.target.value);
            setContributionDayError('');
          }}
          required
          type="number"
          value={contributionDay}
        />
        <div className="sm:col-span-2">
          <button className={primaryButton} disabled={mutation.isPending} type="submit">
            <Check aria-hidden="true" className="size-5" />
            {mutation.isPending ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
        <div className="sm:col-span-2">
          <AuthError error={mutation.error} />
        </div>
      </form>
    </section>
  );
}

function buildDistributionDraft(people) {
  return people.map((person) => ({
    id: person.id,
    name: person.name,
    active: person.isActive,
    contributionBps: person.contributionBps,
    percentage: bpsToPercent(person.contributionBps),
  }));
}

function DistributionEditor({ householdId, initialMode, people, canManage }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('PERCENTAGE');
  const [draft, setDraft] = useState(() => buildDistributionDraft(people));
  const [validationError, setValidationError] = useState('');
  const mutation = useMutation({
    mutationFn: householdService.updateDistribution,
    onSuccess: (result) => {
      queryClient.setQueryData(
        [...queryKeys.households.detail(householdId), 'people'],
        { contributionMode: result.contributionMode, people: result.people },
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.households.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.households.detail(householdId) });
      toast.success('Reparto actualizado para todas las personas.');
    },
  });

  useEffect(() => {
    setMode('PERCENTAGE');
    setDraft(buildDistributionDraft(people));
    setValidationError('');
  }, [initialMode, people]);

  const percentageTotal = useMemo(
    () =>
      draft.reduce((total, person) => {
        if (!person.active) return total;
        try {
          return total + percentToBps(person.percentage);
        } catch {
          return total;
        }
      }, 0),
    [draft],
  );
  function changePerson(personId, field, value) {
    setDraft((current) =>
      current.map((person) =>
        person.id === personId ? { ...person, [field]: value } : person,
      ),
    );
  }

  function handleSubmit(event) {
    event.preventDefault();

    try {
      const updates = draft.map((person) => {
        if (mode === 'PERCENTAGE') {
          return {
            personId: person.id,
            isActive: person.active,
            contributionBps: percentToBps(person.percentage || '0'),
          };
        }

      });
      const activeUpdates = updates.filter((person) => person.isActive);

      if (
        mode === 'PERCENTAGE' &&
        activeUpdates.reduce((total, person) => total + person.contributionBps, 0) !==
          10000
      ) {
        throw new Error('Los porcentajes de las personas activas deben sumar exactamente 100 %.');
      }

      setValidationError('');
      mutation.mutate({
        householdId,
        body: { contributionMode: mode, people: updates },
      });
    } catch (error) {
      setValidationError(error.message);
    }
  }

  if (people.length === 0) {
    return (
      <EmptyState
        description="Añade una persona y después actívala al guardar un reparto válido."
        icon={UsersRound}
        title="Todavía no hay personas en el reparto"
      />
    );
  }

  if (!canManage) {
    return (
      <ul className="space-y-3">
        {people.map((person) => (
          <li className="rounded-2xl border border-border bg-surface p-4" key={person.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-text">{person.name}</p>
              <span className="text-sm font-semibold text-text-muted">
                {person.isActive ? `${person.contributionBps / 100} %` : 'No participa'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset>
        <legend className="text-sm font-bold text-text">Forma de repartir</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            ['PERCENTAGE', 'Porcentaje', 'Las personas activas deben sumar 100 %.'],
          ].map(([value, label, description]) => (
            <label
              className={`flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                mode === value
                  ? 'border-brand bg-brand-soft'
                  : 'border-border-strong bg-surface'
              }`}
              key={value}
            >
              <input
                checked={mode === value}
                className="mt-1 size-4 accent-brand"
                name="contributionMode"
                onChange={() => setMode(value)}
                type="radio"
                value={value}
              />
              <span>
                <span className="block text-sm font-bold text-text">{label}</span>
                <span className="mt-1 block text-xs leading-5 text-text-muted">
                  {description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <ul className="mt-5 space-y-3">
        {draft.map((person) => (
          <li
            className="rounded-2xl border border-border bg-surface-muted p-4"
            key={person.id}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-lg">
                <input
                  checked={person.active}
                  className="size-5 rounded accent-brand"
                  onChange={(event) =>
                    changePerson(person.id, 'active', event.target.checked)
                  }
                  type="checkbox"
                />
                <span>
                  <span className="block font-bold text-text">{person.name}</span>
                  <span className="block text-xs text-text-muted">
                    {person.active ? 'Participa en el reparto' : 'No participa todavía'}
                  </span>
                </span>
              </label>
              <div className="sm:w-48">
                <label
                  className="mb-1.5 block text-sm font-bold text-text"
                  htmlFor={`contribution-${person.id}`}
                >
                  Porcentaje (%)
                  <span className="sr-only"> de {person.name}</span>
                </label>
                <input
                  className={inputClass}
                  disabled={!person.active}
                  id={`contribution-${person.id}`}
                  inputMode="decimal"
                  onChange={(event) =>
                    changePerson(
                      person.id,
                      'percentage',
                      event.target.value,
                    )
                  }
                  value={person.percentage}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          aria-live="polite"
          className={`text-sm font-bold ${
            mode === 'PERCENTAGE' && percentageTotal !== 10000
              ? 'text-red-700'
              : 'text-brand-strong'
          }`}
        >
          {mode === 'PERCENTAGE'
            ? `Total activo: ${(percentageTotal / 100).toLocaleString('es-ES')} %`
            : `${draft.filter((person) => person.active).length} personas activas`}
        </p>
        <button
          className={primaryButton}
          disabled={mutation.isPending}
          type="submit"
        >
          <WalletCards aria-hidden="true" className="size-5" />
          {mutation.isPending ? 'Guardando reparto…' : 'Guardar reparto completo'}
        </button>
      </div>
      {validationError ? (
        <p className="mt-3 text-sm font-semibold text-red-700" role="alert">
          {validationError}
        </p>
      ) : null}
      <div className="mt-3">
        <AuthError error={mutation.error} />
      </div>
    </form>
  );
}

function AddPersonForm({ householdId }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const mutation = useMutation({
    mutationFn: householdService.createPerson,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.households.detail(householdId), 'people'],
      });
      setName('');
      setEmail('');
      toast.success('Persona añadida. Actívala al guardar el nuevo reparto.');
    },
  });

  return (
    <form
      className="mt-6 border-t border-border pt-6"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate({
          householdId,
          body: {
            name: name.trim(),
            ...(email.trim() ? { email: email.trim() } : {}),
            isActive: false,
            contributionBps: 0,
          },
        });
      }}
    >
      <h3 className="font-bold text-text">Añadir otra persona</h3>
      <p className="mt-1 text-sm leading-6 text-text-muted">
        Se añadirá inactiva para que el reparto actual siga siendo válido hasta que lo guardes de nuevo.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField
          label="Nombre"
          maxLength={120}
          name="newPersonName"
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej. Sam"
          required
          value={name}
        />
        <FormField
          autoComplete="email"
          help="Opcional. Sirve para preparar una invitación más adelante."
          label="Correo electrónico"
          maxLength={320}
          name="newPersonEmail"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="persona@ejemplo.com"
          type="email"
          value={email}
        />
      </div>
      <button
        className={`${secondaryButton} mt-4`}
        disabled={mutation.isPending}
        type="submit"
      >
        <UserPlus aria-hidden="true" className="size-5" />
        {mutation.isPending ? 'Añadiendo…' : 'Añadir persona inactiva'}
      </button>
      <div className="mt-3">
        <AuthError error={mutation.error} />
      </div>
    </form>
  );
}

function InvitationForm({ household, people }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [personId, setPersonId] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [validationError, setValidationError] = useState('');
  const [invitationLink, setInvitationLink] = useState('');
  const availablePeople = people.filter((person) => !person.linkedUserId);
  const mutation = useMutation({
    mutationFn: householdService.invite,
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.households.detail(household.id), 'invitations'],
      });
      const token = result.token;
      setInvitationLink(
        token
          ? `${window.location.origin}/invitaciones/aceptar#token=${encodeURIComponent(token)}`
          : '',
      );
      setEmail('');
      setPersonId('');
      setValidationError('');
      toast.success(
        result.emailSent
          ? 'Invitación creada y enviada por correo.'
          : 'Invitación creada. Copia el enlace para compartirlo.',
      );
    },
  });

  function handleSubmit(event) {
    event.preventDefault();
    if (!email.trim() && !personId) {
      setValidationError('Indica un correo o elige una persona del hogar.');
      return;
    }

    setValidationError('');
    mutation.mutate({
      householdId: household.id,
      body: {
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(personId ? { householdPersonId: personId } : {}),
        role: household.access?.role === 'OWNER' ? role : 'MEMBER',
      },
    });
  }

  if (!isOpen && !invitationLink) {
    return (
      <button className={secondaryButton} onClick={() => setIsOpen(true)} type="button">
        <MailPlus aria-hidden="true" className="size-5" />
        Crear una invitación opcional
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {invitationLink ? (
        <div className="space-y-3">
          <SuccessNotice
            description="Este enlace contiene un token de un solo uso. Compártelo únicamente con la persona invitada."
            title="Enlace seguro creado"
          />
          <div>
            <label className="mb-1.5 block text-sm font-bold text-text" htmlFor="invitation-link">
              Enlace de invitación
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className={`${inputClass} font-mono text-sm`}
                id="invitation-link"
                readOnly
                value={invitationLink}
              />
              <button
                className={secondaryButton}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(invitationLink);
                    toast.success('Enlace copiado.');
                  } catch {
                    toast.error('No se pudo copiar. Selecciona el enlace manualmente.');
                  }
                }}
                type="button"
              >
                <Copy aria-hidden="true" className="size-4" />
                Copiar enlace
              </button>
            </div>
          </div>
          <button
            className="min-h-11 rounded-xl px-3 text-sm font-bold text-text-muted hover:bg-surface-muted"
            onClick={() => {
              setInvitationLink('');
              setIsOpen(false);
            }}
            type="button"
          >
            Cerrar enlace
          </button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-text" htmlFor="invitation-person">
                Persona del hogar
              </label>
              <select
                className={inputClass}
                id="invitation-person"
                onChange={(event) => setPersonId(event.target.value)}
                value={personId}
              >
                <option value="">Sin vincular una persona</option>
                {availablePeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </div>
            <FormField
              autoComplete="email"
              help="Puedes dejarlo vacío si la persona elegida ya tiene correo."
              label="Correo de la invitación"
              maxLength={320}
              name="invitationEmail"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="persona@ejemplo.com"
              type="email"
              value={email}
            />
          </div>
          {household.access?.role === 'OWNER' ? (
            <fieldset>
              <legend className="text-sm font-bold text-text">Permiso al aceptar</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {[
                  ['MEMBER', 'Miembro'],
                  ['ADMIN', 'Administrador'],
                ].map(([value, label]) => (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2" key={value}>
                    <input
                      checked={role === value}
                      className="size-4 accent-brand"
                      name="invitationRole"
                      onChange={() => setRole(value)}
                      type="radio"
                    />
                    <span className="text-sm font-semibold text-text">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          {validationError ? (
            <p className="text-sm font-semibold text-red-700" role="alert">
              {validationError}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button className={primaryButton} disabled={mutation.isPending} type="submit">
              <Link2 aria-hidden="true" className="size-5" />
              {mutation.isPending ? 'Creando invitación…' : 'Crear enlace seguro'}
            </button>
            <button
              className="min-h-11 rounded-xl px-4 text-sm font-bold text-text-muted hover:bg-surface-muted"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              Cancelar
            </button>
          </div>
          <AuthError error={mutation.error} />
        </form>
      )}
    </div>
  );
}

function InvitationsSection({ household, people, query, canManage }) {
  const queryClient = useQueryClient();
  const [revokingInvitationId, setRevokingInvitationId] = useState(null);
  const revokeMutation = useMutation({
    mutationFn: householdService.revokeInvitation,
    onError: () => setRevokingInvitationId(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...queryKeys.households.detail(household.id), 'invitations'],
      });
      setRevokingInvitationId(null);
      toast.success('Invitación cancelada.');
    },
  });

  if (!canManage) {
    return (
      <RestrictedState
        description="Solo administradores y propietarios pueden consultar o crear invitaciones."
        title="Invitaciones restringidas"
      />
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <SectionHeading
        description="El hogar funciona sin cuentas adicionales. Invita solo si alguien necesita entrar en la aplicación."
        icon={MailPlus}
        title="Invitaciones opcionales"
      />
      <div className="mt-6">
        <InvitationForm household={household} people={people} />
      </div>
      <div className="mt-6 border-t border-border pt-5">
        <h3 className="font-bold text-text">Historial de invitaciones</h3>
        {query.isPending ? (
          <p aria-live="polite" className="mt-3 text-sm text-text-muted" role="status">
            Cargando invitaciones…
          </p>
        ) : null}
        {query.isError ? (
          <div className="mt-3">
            <ErrorState
              description={query.error.message}
              onRetry={query.refetch}
              title="No se han podido cargar las invitaciones"
            />
          </div>
        ) : null}
        {query.isSuccess && query.data.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-text-muted">
            No has creado ninguna invitación. No es necesario hacerlo para calcular el presupuesto.
          </p>
        ) : null}
        {query.isSuccess && query.data.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {query.data.map((invitation) => (
              <li
                className="flex flex-col gap-2 rounded-xl bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between"
                key={invitation.id}
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold text-text">
                    {invitation.householdPerson?.name ?? invitation.email ?? 'Enlace sin correo'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    {roleLabels[invitation.role]} · Caduca {formatDate(invitation.expiresAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-text-muted">
                    {invitationStatusLabels[invitation.status] ?? invitation.status}
                  </span>
                  {invitation.status === 'PENDING' ? (
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 px-3 py-2 text-sm font-bold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                      onClick={() => {
                        revokeMutation.reset();
                        setRevokingInvitationId(invitation.id);
                      }}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {revokeMutation.error ? (
          <div className="mt-3">
            <AuthError error={revokeMutation.error} />
          </div>
        ) : null}
      </div>
      {revokingInvitationId ? (
        <ConfirmationDialog
          cancelLabel="No, mantenerla"
          confirmLabel="Cancelar invitación"
          description="El enlace dejará de funcionar y la persona invitada ya no podrá utilizarlo. Esta acción no elimina a nadie del hogar."
          isPending={revokeMutation.isPending}
          onCancel={() => setRevokingInvitationId(null)}
          onConfirm={() => revokeMutation.mutate({
            householdId: household.id,
            invitationId: revokingInvitationId,
          })}
          pendingLabel="Cancelando…"
          title="¿Cancelar esta invitación?"
        />
      ) : null}
    </section>
  );
}

export function HouseholdPage() {
  const householdState = useHousehold();
  const householdId = householdState.currentHousehold?.id;
  const detailQuery = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => householdService.get(householdId),
    queryKey: queryKeys.households.detail(householdId),
  });
  const peopleQuery = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => householdService.listPeople(householdId),
    queryKey: [...queryKeys.households.detail(householdId), 'people'],
  });
  const household = detailQuery.data ?? householdState.currentHousehold;
  const canManage = ['ADMIN', 'OWNER'].includes(household?.access?.role);
  const invitationQuery = useQuery({
    enabled: Boolean(householdId && canManage),
    queryFn: () => householdService.listInvitations(householdId),
    queryKey: [...queryKeys.households.detail(householdId), 'invitations'],
  });
  const peopleTitleId = useId();

  if (householdState.isPending) return <LoadingState label="Cargando hogares" />;
  if (householdState.isError) {
    return (
      <ErrorState
        description={householdState.error.message}
        onRetry={householdState.refetch}
        title="No se han podido cargar tus hogares"
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Personas y permisos"
        title="Tu hogar"
      />

      {!householdId ? (
        <HouseholdOnboarding householdState={householdState} />
      ) : (
        <>
          <HouseholdSelector householdState={householdState} />

          {detailQuery.isError ? (
            <ErrorState
              description={detailQuery.error.message}
              onRetry={detailQuery.refetch}
              title="No se ha podido actualizar el resumen"
            />
          ) : (
            <HouseholdSummary household={household} />
          )}

          <HouseholdSettings canManage={canManage} household={household} />

          <section
            aria-labelledby={peopleTitleId}
            className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6"
          >
            <div id={peopleTitleId}>
              <SectionHeading
                description="Las personas económicas pueden participar aunque no tengan una cuenta en la aplicación."
                icon={UsersRound}
                title="Personas y reparto"
              />
            </div>
            <div className="mt-6">
              {peopleQuery.isPending ? <LoadingState label="Cargando personas" /> : null}
              {peopleQuery.isError ? (
                <ErrorState
                  description={peopleQuery.error.message}
                  onRetry={peopleQuery.refetch}
                  title="No se han podido cargar las personas"
                />
              ) : null}
              {peopleQuery.isSuccess ? (
                <>
                  <DistributionEditor
                    canManage={canManage}
                    householdId={householdId}
                    initialMode={peopleQuery.data.contributionMode}
                    people={peopleQuery.data.people}
                  />
                  {canManage ? <AddPersonForm householdId={householdId} /> : null}
                </>
              ) : null}
            </div>
          </section>

          <InvitationsSection
            canManage={canManage}
            household={household}
            people={peopleQuery.data?.people ?? []}
            query={invitationQuery}
          />
        </>
      )}
    </div>
  );
}
