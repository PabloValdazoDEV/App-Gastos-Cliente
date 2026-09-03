import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { queryKeys } from '../../api/queryKeys';
import { householdService } from './householdService';
import { HouseholdContext } from './householdStateContext';

const STORAGE_KEY = 'budgetapp.currentHouseholdId';

function initialHouseholdId() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function HouseholdProvider({ children }) {
  const [selectedId, setSelectedId] = useState(initialHouseholdId);
  const query = useQuery({
    queryKey: queryKeys.households.all(),
    queryFn: householdService.list,
  });
  const households = useMemo(() => query.data ?? [], [query.data]);
  const currentHousehold =
    households.find((household) => household.id === selectedId) ?? households[0] ?? null;

  useEffect(() => {
    if (!currentHousehold || currentHousehold.id === selectedId) return;
    setSelectedId(currentHousehold.id);
  }, [currentHousehold, selectedId]);

  useEffect(() => {
    try {
      if (currentHousehold?.id) {
        window.localStorage.setItem(STORAGE_KEY, currentHousehold.id);
      } else if (query.isSuccess) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // La selección sigue funcionando durante esta sesión aunque storage falle.
    }
  }, [currentHousehold?.id, query.isSuccess]);

  const value = useMemo(
    () => ({
      currentHousehold,
      households,
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
      selectHousehold: setSelectedId,
    }),
    [currentHousehold, households, query.error, query.isError, query.isPending, query.refetch],
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

