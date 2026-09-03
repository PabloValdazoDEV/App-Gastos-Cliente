import { useContext } from 'react';

import { HouseholdContext } from './householdStateContext';

export function useHousehold() {
  const value = useContext(HouseholdContext);
  if (!value) throw new Error('useHousehold debe usarse dentro de HouseholdProvider.');
  return value;
}
