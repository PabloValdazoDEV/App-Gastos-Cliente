import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, UserPlus, WalletCards } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { ErrorState, LoadingState } from '../../../components/ui/FeedbackStates';
import { ConfirmationDialog } from '../../../pages/expensePageShared';
import { AuthError } from '../../auth/components/AuthFeedback';
import { FormField } from '../../auth/components/FormField';
import { financeService } from '../financeService';
import { eurosInputToCents, formatCents } from '../money';

const primaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-on-brand shadow-sm transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-bold text-text transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';
const inputClass =
  'mt-2 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-base text-text shadow-sm outline-none transition-colors placeholder:text-text-soft focus:border-brand focus:ring-3 focus:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted';

function SectionHeading({ description, icon: Icon, title }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold tracking-tight text-text">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-text-muted">{description}</p> : null}
      </div>
    </div>
  );
}

function AccountCard({ account, currency, onDelete, onEdit }) {
  return (
    <li className="min-w-0 rounded-2xl border border-border bg-surface-muted p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-bold text-text">{account.name}</p>
          <p className="mt-1 text-xs text-text-muted">
            {account.scope === 'PERSONAL' ? account.personalPerson?.name ?? 'Cuenta personal' : 'Cuenta conjunta'}
          </p>
        </div>
        <p className="shrink-0 text-lg font-extrabold text-text">
          {formatCents(account.balanceCents, currency)}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border-strong px-3 py-2 text-sm font-bold text-text min-[430px]:flex-none"
          onClick={() => onEdit(account)}
          type="button"
        >
          <Pencil aria-hidden="true" className="size-4" />
          Editar
        </button>
        <button
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-red-300 px-3 py-2 text-sm font-bold text-red-800 min-[430px]:flex-none"
          onClick={() => onDelete(account.id)}
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Eliminar
        </button>
      </div>
    </li>
  );
}

export function AccountsSection({ currency, householdId, people }) {
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({
    queryKey: ['accounts', householdId],
    queryFn: () => financeService.accounts(householdId),
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [name, setName] = useState('');
  const [scope, setScope] = useState('HOUSEHOLD');
  const [personalPersonId, setPersonalPersonId] = useState('');
  const [balance, setBalance] = useState('');
  const [error, setError] = useState('');
  const accounts = accountsQuery.data ?? [];
  const commonAccounts = accounts.filter((account) => account.scope !== 'PERSONAL');
  const personalAccounts = accounts.filter((account) => account.scope === 'PERSONAL');
  const commonBalanceCents = commonAccounts.reduce((total, account) => total + account.balanceCents, 0);
  const personalBalanceCents = personalAccounts.reduce((total, account) => total + account.balanceCents, 0);
  const deletingAccount = accounts.find((account) => account.id === deletingId);
  const save = useMutation({
    mutationFn: editingId ? financeService.updateAccount : financeService.createAccount,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts', householdId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', householdId] }),
      ]);
      setShowForm(false);
      setEditingId(null);
      toast.success('Cuenta guardada.');
    },
  });
  const remove = useMutation({
    mutationFn: financeService.deleteAccount,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts', householdId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', householdId] }),
      ]);
      setDeletingId(null);
      toast.success('Cuenta eliminada.');
    },
  });

  function openCreate() {
    setEditingId(null);
    setName('');
    setScope('HOUSEHOLD');
    setPersonalPersonId('');
    setBalance('');
    setError('');
    setShowForm(true);
  }

  function openEdit(account) {
    setEditingId(account.id);
    setName(account.name);
    setScope(account.scope);
    setPersonalPersonId(account.personalPersonId ?? '');
    setBalance((account.balanceCents / 100).toFixed(2).replace('.', ','));
    setError('');
    setShowForm(true);
  }

  function submit(event) {
    event.preventDefault();
    try {
      if (!name.trim()) throw new Error('Introduce un nombre para la cuenta.');
      if (scope === 'PERSONAL' && !personalPersonId) throw new Error('Selecciona la persona de la cuenta.');
      setError('');
      save.mutate({
        householdId,
        ...(editingId ? { accountId: editingId } : {}),
        body: {
          name: name.trim(),
          scope,
          personalPersonId: scope === 'PERSONAL' ? personalPersonId : null,
          balanceCents: eurosInputToCents(balance || '0'),
        },
      });
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <SectionHeading
        description="Aquí puedes tener juntas la cuenta común y las cuentas personales. Los saldos se usan para comprobar si cada cuenta llega bien a fin de mes."
        icon={WalletCards}
        title="Cuentas y saldos"
      />
      {accountsQuery.isPending ? <LoadingState label="Cargando cuentas" /> : null}
      {accountsQuery.isError ? <ErrorState description={accountsQuery.error.message} onRetry={accountsQuery.refetch} title="No se han podido cargar las cuentas" /> : null}
      {accountsQuery.isSuccess ? (
        <>
          <dl className="mt-5 grid gap-3 rounded-2xl bg-surface-muted p-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-text-muted">Total cuenta conjunta</dt>
              <dd className="mt-1 text-xl font-extrabold text-text">{formatCents(commonBalanceCents, currency)}</dd>
              <dd className="mt-1 text-xs text-text-muted">{commonAccounts.length === 1 ? '1 cuenta' : `${commonAccounts.length} cuentas`}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-muted">Total cuentas personales</dt>
              <dd className="mt-1 text-xl font-extrabold text-text">{formatCents(personalBalanceCents, currency)}</dd>
              <dd className="mt-1 text-xs text-text-muted">{personalAccounts.length === 1 ? '1 cuenta' : `${personalAccounts.length} cuentas`}</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-xl bg-surface-muted p-4 text-sm leading-6 text-text-muted">
            Puedes añadir varias cuentas personales o conjuntas. Los saldos se introducen manualmente; no hay conexión bancaria automática.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={primaryButton} onClick={openCreate} type="button">
              <UserPlus aria-hidden="true" className="size-5" />
              Añadir cuenta
            </button>
          </div>
          {showForm ? (
            <form className="mt-5 grid gap-5 border-t border-border pt-5 sm:grid-cols-2" onSubmit={submit}>
              <FormField label="Nombre de la cuenta" maxLength={120} onChange={(event) => setName(event.target.value)} required value={name} />
              <FormField error={error} inputMode="decimal" label="Saldo actual (€)" onChange={(event) => setBalance(event.target.value)} placeholder="0,00" value={balance} />
              <label className="block text-sm font-bold text-text">
                Tipo
                <select className={inputClass} onChange={(event) => setScope(event.target.value)} value={scope}>
                  <option value="HOUSEHOLD">Cuenta conjunta</option>
                  <option value="PERSONAL">Cuenta personal</option>
                </select>
              </label>
              {scope === 'PERSONAL' ? (
                <label className="block text-sm font-bold text-text">
                  Persona
                  <select className={inputClass} onChange={(event) => setPersonalPersonId(event.target.value)} value={personalPersonId}>
                    <option value="">Selecciona una persona</option>
                    {people.filter((person) => person.isActive !== false).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
              ) : null}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button className={primaryButton} disabled={save.isPending} type="submit">
                  {save.isPending ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Guardar cuenta'}
                </button>
                <button className={secondaryButton} onClick={() => setShowForm(false)} type="button">Cancelar</button>
              </div>
              <div className="sm:col-span-2"><AuthError error={save.error} /></div>
            </form>
          ) : null}
          {deletingAccount ? (
            <ConfirmationDialog
              confirmLabel="Eliminar cuenta"
              description="La cuenta dejará de aparecer en los cálculos. El resto de gastos del hogar no se modificará."
              isPending={remove.isPending}
              onCancel={() => setDeletingId(null)}
              onConfirm={() => remove.mutate({ householdId, accountId: deletingAccount.id })}
              pendingLabel="Eliminando…"
              title="¿Eliminar esta cuenta?"
            />
          ) : null}
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <AccountGroup accounts={commonAccounts} currency={currency} onDelete={setDeletingId} onEdit={openEdit} title="Cuenta conjunta" />
            <AccountGroup accounts={personalAccounts} currency={currency} onDelete={setDeletingId} onEdit={openEdit} title="Cuentas personales" />
          </div>
        </>
      ) : null}
    </section>
  );
}

function AccountGroup({ accounts, currency, onDelete, onEdit, title }) {
  return (
    <section aria-labelledby={`accounts-${title.toLowerCase().replaceAll(' ', '-')}`}>
      <h3 className="text-sm font-extrabold text-text" id={`accounts-${title.toLowerCase().replaceAll(' ', '-')}`}>{title}</h3>
      {accounts.length ? (
        <ul className="mt-3 space-y-3">
          {accounts.map((account) => <AccountCard account={account} currency={currency} key={account.id} onDelete={onDelete} onEdit={onEdit} />)}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-border-strong p-4 text-sm text-text-muted">Todavía no hay cuentas configuradas.</p>
      )}
    </section>
  );
}
