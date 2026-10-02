import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

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
  const switchGuards = useRef(new Map());
  const registerSwitchGuard = useCallback((guard) => {
    const key = Symbol('household-draft');
    switchGuards.current.set(key, guard);
    return () => switchGuards.current.delete(key);
  }, []);
  const currentHouseholdId = currentHousehold?.id;
  const selectHousehold = useCallback((id) => {
    if (id === currentHouseholdId) return;
    const guards = [...switchGuards.current.values()];
    if (guards.some((guard) => guard.pending)) {
      toast.error('Espera a que termine la operación antes de cambiar de hogar.');
      return;
    }
    if (guards.some((guard) => guard.dirty) && !window.confirm(
      'Hay cambios o una simulación en este hogar. Si cambias de hogar se descartarán. ¿Cambiar de hogar?',
    )) return;
    setSelectedId(id);
  }, [currentHouseholdId]);

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
      selectHousehold,
      registerSwitchGuard,
    }),
    [currentHousehold, households, query.error, query.isError, query.isPending, query.refetch, selectHousehold, registerSwitchGuard],
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}
