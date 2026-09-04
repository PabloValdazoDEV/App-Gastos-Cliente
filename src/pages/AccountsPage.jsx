import { useQuery } from '@tanstack/react-query';
import { WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { AccountsSection } from '../features/finance/components/AccountsSection';
import { householdService } from '../features/households/householdService';
import { useHousehold } from '../features/households/useHousehold';

export function AccountsPage() {
  const householdState = useHousehold();
  const householdId = householdState.currentHousehold?.id;
  const peopleQuery = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => householdService.listPeople(householdId),
    queryKey: ['household', householdId, 'people'],
  });

  if (householdState.isPending) return <LoadingState label="Cargando hogar" />;
  if (householdState.isError) {
    return <ErrorState description={householdState.error.message} onRetry={householdState.refetch} />;
  }
  if (!householdId) {
    return (
      <EmptyState
        action={<Link className="font-bold text-brand-strong" to="/hogar">Crear hogar</Link>}
        description="Configura primero un hogar para poder añadir sus cuentas y saldos."
        icon={WalletCards}
        title="Todavía no hay un hogar"
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Organización del dinero" title="Cuentas y saldos" />
      <AccountsSection
        currency={householdState.currentHousehold.currency}
        householdId={householdId}
        people={peopleQuery.data?.people ?? []}
      />
      {peopleQuery.isError ? (
        <ErrorState
          description={peopleQuery.error.message}
          onRetry={peopleQuery.refetch}
          title="No se han podido cargar las personas del hogar"
        />
      ) : null}
    </div>
  );
}
