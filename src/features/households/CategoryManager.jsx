import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Check,
  Pencil,
  Plus,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { queryKeys } from '../../api/queryKeys';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../../components/ui/FeedbackStates';
import { AuthError } from '../auth/components/AuthFeedback';
import { FormField } from '../auth/components/FormField';
import { householdService } from './householdService';
import { categoryIconLabels, categoryIconOptions as iconOptions } from './categoryIconDefinitions';
import { CategoryIconBadge } from './categoryIcons';

const inputClass =
  'min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-base text-text shadow-sm outline-none transition-colors focus:border-brand focus:ring-3 focus:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted';
const primaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';

function percentFromBps(value) {
  return Number.isInteger(value) ? String(value / 100).replace('.', ',') : '';
}

function marginToBps(enabled, value) {
  if (!enabled) return null;
  const normalized = String(value).trim().replace(',', '.');
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Introduce un margen con un máximo de dos decimales.');
  }
  const percent = Number(normalized);
  if (percent < 0 || percent > 100) {
    throw new Error('El margen debe estar entre 0 % y 100 %.');
  }
  return Math.round(percent * 100);
}

function CategoryForm({ category, isPending, onCancel, onSubmit, submitLabel }) {
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? 'Shapes');
  const [color, setColor] = useState(category?.color ?? '#4F6F62');
  const [specificMargin, setSpecificMargin] = useState(
    Number.isInteger(category?.safetyMarginBps),
  );
  const [margin, setMargin] = useState(percentFromBps(category?.safetyMarginBps));
  const [validationError, setValidationError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    try {
      const normalizedName = name.trim();
      if (!normalizedName) throw new Error('Introduce el nombre de la categoría.');
      if (!/^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(icon)) {
        throw new Error('Selecciona un icono válido.');
      }
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        throw new Error('Introduce un color hexadecimal válido.');
      }
      const safetyMarginBps = marginToBps(specificMargin, margin);
      setValidationError('');
      onSubmit({
        color: color.toUpperCase(),
        icon,
        name: normalizedName,
        safetyMarginBps,
      });
    } catch (error) {
      setValidationError(error.message);
    }
  }

  return (
    <form className="mt-5 space-y-5" noValidate onSubmit={handleSubmit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Nombre de la categoría"
          maxLength={80}
          name="categoryName"
          onChange={(event) => setName(event.target.value)}
          placeholder="Por ejemplo, Viajes"
          required
          value={name}
        />
        <div>
          <label className="mb-1.5 block text-sm font-bold text-text" htmlFor="category-icon">
            Icono
          </label>
          <select
            className={inputClass}
            id="category-icon"
            onChange={(event) => setIcon(event.target.value)}
            value={icon}
          >
            {iconOptions.map((option) => (
              <option key={option} value={option}>
                {categoryIconLabels[option]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-bold text-text" htmlFor="category-color">
            Color
          </label>
          <div className="flex items-center gap-3">
            <input
              aria-label="Selector de color"
              className="size-12 shrink-0 cursor-pointer rounded-xl border border-border-strong bg-surface p-1"
              onChange={(event) => setColor(event.target.value)}
              type="color"
              value={color}
            />
            <input
              className={inputClass}
              id="category-color"
              maxLength={7}
              onChange={(event) => setColor(event.target.value)}
              pattern="#[0-9A-Fa-f]{6}"
              value={color}
            />
          </div>
        </div>
        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold text-text">
            <input
              checked={specificMargin}
              className="size-5 rounded accent-brand"
              onChange={(event) => setSpecificMargin(event.target.checked)}
              type="checkbox"
            />
            Usar margen específico
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              aria-label="Margen específico de la categoría"
              className={inputClass}
              disabled={!specificMargin}
              inputMode="decimal"
              max="100"
              min="0"
              onChange={(event) => setMargin(event.target.value)}
              placeholder="10"
              step="0.01"
              value={margin}
            />
            <span aria-hidden="true" className="font-bold text-text-muted">
              %
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-text-muted">
            Desactivado: heredará el margen general del hogar.
          </p>
        </div>
      </div>
      {validationError ? (
        <p className="text-sm font-semibold text-red-700" role="alert">
          {validationError}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button className={primaryButton} disabled={isPending} type="submit">
          <Check aria-hidden="true" className="size-4" />
          {isPending ? 'Guardando…' : submitLabel}
        </button>
        <button className={secondaryButton} disabled={isPending} onClick={onCancel} type="button">
          <X aria-hidden="true" className="size-4" />
          Cancelar
        </button>
      </div>
    </form>
  );
}

function CategoryRow({
  canDelete,
  canManage,
  category,
  householdMarginBps,
  isArchiving,
  isDeleting,
  onArchive,
  onDelete,
  onEdit,
}) {
  const marginLabel = Number.isInteger(category.safetyMarginBps)
    ? `${category.safetyMarginBps / 100} % propio`
    : `${householdMarginBps / 100} % general`;

  return (
    <div className="rounded-2xl border border-border bg-surface-muted p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <CategoryIconBadge category={category} className="size-11" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-words font-extrabold text-text">{category.name}</p>
              {category.isDefault ? (
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-bold text-text-muted">
                  Predeterminada
                </span>
              ) : null}
              {category.archivedAt ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                  Archivada
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              Icono {categoryIconLabels[category.icon] ?? 'personalizado'} · Margen {marginLabel}
            </p>
          </div>
        </div>
        {canManage ? (
          <div className="flex flex-col gap-2 min-[430px]:flex-row sm:justify-end">
            {!category.archivedAt ? (
              <>
                <button className={secondaryButton} onClick={onEdit} type="button">
                  <Pencil aria-hidden="true" className="size-4" />
                  Editar
                </button>
                <button
                  className={secondaryButton}
                  disabled={isArchiving}
                  onClick={onArchive}
                  type="button"
                >
                  <Archive aria-hidden="true" className="size-4" />
                  {isArchiving ? 'Archivando…' : 'Archivar'}
                </button>
              </>
            ) : canDelete ? (
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 bg-surface px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
                disabled={isDeleting}
                onClick={onDelete}
                type="button"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                {isDeleting ? 'Eliminando…' : 'Eliminar definitivamente'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CategoryManager({ household }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [archiveConfirmationId, setArchiveConfirmationId] = useState(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState(null);
  const canManage = ['ADMIN', 'OWNER'].includes(household.access?.role);
  const canDelete = household.access?.role === 'OWNER';
  const categoriesQuery = useQuery({
    queryFn: () => householdService.listCategories(household.id, { includeArchived: true }),
    queryKey: queryKeys.categories.list(household.id, { includeArchived: true }),
  });
  const invalidateCategories = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.categories.all(household.id) });
  const createCategory = useMutation({
    mutationFn: householdService.createCategory,
    onSuccess: async () => {
      await invalidateCategories();
      setShowCreate(false);
      toast.success('Categoría creada.');
    },
  });
  const updateCategory = useMutation({
    mutationFn: householdService.updateCategory,
    onSuccess: async () => {
      await invalidateCategories();
      setEditingId(null);
      toast.success('Categoría actualizada.');
    },
  });
  const archiveCategory = useMutation({
    mutationFn: householdService.archiveCategory,
    onSuccess: async () => {
      await invalidateCategories();
      setArchiveConfirmationId(null);
      toast.success('Categoría archivada; el histórico se conserva.');
    },
  });
  const deleteCategory = useMutation({
    mutationFn: householdService.deleteCategory,
    onSuccess: async () => {
      await invalidateCategories();
      setDeleteConfirmationId(null);
      toast.success('Categoría eliminada.');
    },
  });
  const result = categoriesQuery.data;
  const categories = result?.categories ?? [];
  const householdMarginBps = result?.householdSafetyMarginBps ?? household.safetyMarginBps;
  const mutationError =
    createCategory.error ??
    updateCategory.error ??
    archiveCategory.error ??
    deleteCategory.error;

  return (
    <section
      aria-labelledby="category-settings-title"
      className="rounded-2xl border border-border bg-surface p-5 sm:p-7"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-strong">
              <Tags aria-hidden="true" className="size-5" />
            </span>
            <h2 className="text-lg font-extrabold" id="category-settings-title">
              Categorías
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
            El color y el icono ayudan a reconocer los gastos. Un margen propio sustituye al
            general solo en esa categoría.
          </p>
        </div>
        {canManage && !showCreate ? (
          <button
            className={primaryButton}
            onClick={() => {
              setEditingId(null);
              setShowCreate(true);
            }}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            Nueva categoría
          </button>
        ) : null}
      </div>

      {!canManage ? (
        <p className="mt-5 rounded-xl border border-border bg-surface-muted p-4 text-sm leading-6 text-text-muted">
          Puedes consultar las categorías. Solo administradores y propietarios pueden cambiarlas.
        </p>
      ) : null}

      {showCreate ? (
        <div className="mt-5 rounded-2xl border border-brand/30 bg-brand-soft/40 p-4 sm:p-5">
          <h3 className="font-extrabold text-text">Crear categoría</h3>
          <CategoryForm
            isPending={createCategory.isPending}
            onCancel={() => setShowCreate(false)}
            onSubmit={(body) => createCategory.mutate({ householdId: household.id, body })}
            submitLabel="Crear categoría"
          />
        </div>
      ) : null}

      <div className="mt-6">
        {categoriesQuery.isPending ? <LoadingState label="Cargando categorías" /> : null}
        {categoriesQuery.isError ? (
          <ErrorState
            description={categoriesQuery.error.message}
            onRetry={categoriesQuery.refetch}
            title="No se han podido cargar las categorías"
          />
        ) : null}
        {categoriesQuery.isSuccess && categories.length === 0 ? (
          <EmptyState
            description="Crea una categoría antes de clasificar tus gastos."
            icon={Tags}
            title="No hay categorías"
          />
        ) : null}
        {categoriesQuery.isSuccess && categories.length > 0 ? (
          <ul className="space-y-3">
            {categories.map((category) => (
              <li key={category.id}>
                <CategoryRow
                  canDelete={canDelete}
                  canManage={canManage}
                  category={category}
                  householdMarginBps={householdMarginBps}
                  isArchiving={
                    archiveCategory.isPending && archiveCategory.variables?.categoryId === category.id
                  }
                  isDeleting={
                    deleteCategory.isPending && deleteCategory.variables?.categoryId === category.id
                  }
                  onArchive={() => {
                    setDeleteConfirmationId(null);
                    setArchiveConfirmationId(category.id);
                  }}
                  onDelete={() => {
                    setArchiveConfirmationId(null);
                    setDeleteConfirmationId(category.id);
                  }}
                  onEdit={() => {
                    setShowCreate(false);
                    setEditingId(category.id);
                  }}
                />
                {editingId === category.id ? (
                  <div className="ml-0 mt-2 rounded-2xl border border-brand/30 bg-brand-soft/40 p-4 sm:ml-4 sm:p-5">
                    <h3 className="font-extrabold text-text">Editar {category.name}</h3>
                    <CategoryForm
                      category={category}
                      isPending={updateCategory.isPending}
                      onCancel={() => setEditingId(null)}
                      onSubmit={(body) =>
                        updateCategory.mutate({
                          householdId: household.id,
                          categoryId: category.id,
                          body,
                        })
                      }
                      submitLabel="Guardar categoría"
                    />
                  </div>
                ) : null}
                {archiveConfirmationId === category.id ? (
                  <div
                    className="ml-0 mt-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:ml-4"
                    role="alert"
                  >
                    <p className="font-bold">¿Archivar {category.name}?</p>
                    <p className="mt-1 leading-6">
                      Dejará de estar disponible para nuevos gastos, pero conservará todos los
                      datos históricos.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 min-[430px]:flex-row">
                      <button
                        className={primaryButton}
                        disabled={archiveCategory.isPending}
                        onClick={() =>
                          archiveCategory.mutate({
                            householdId: household.id,
                            categoryId: category.id,
                          })
                        }
                        type="button"
                      >
                        Confirmar archivo
                      </button>
                      <button
                        className={secondaryButton}
                        onClick={() => setArchiveConfirmationId(null)}
                        type="button"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}
                {deleteConfirmationId === category.id ? (
                  <div
                    className="ml-0 mt-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-950 sm:ml-4"
                    role="alert"
                  >
                    <p className="font-bold">Eliminación permanente</p>
                    <p className="mt-1 leading-6">
                      Solo se eliminará si no tiene ningún gasto, factura o mes variable asociado.
                      Si conserva datos, el servidor rechazará la operación.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 min-[430px]:flex-row">
                      <button
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
                        disabled={deleteCategory.isPending}
                        onClick={() =>
                          deleteCategory.mutate({
                            householdId: household.id,
                            categoryId: category.id,
                          })
                        }
                        type="button"
                      >
                        Confirmar eliminación
                      </button>
                      <button
                        className={secondaryButton}
                        onClick={() => setDeleteConfirmationId(null)}
                        type="button"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="mt-4">
        <AuthError error={mutationError} />
      </div>
    </section>
  );
}
