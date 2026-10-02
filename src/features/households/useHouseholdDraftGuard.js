import { useContext, useEffect } from 'react';

import { HouseholdContext } from './householdStateContext';

// The page still owns its draft. This only protects explicit household switches
// and closing/reloading the tab; it does not persist financial drafts in storage.
export function useHouseholdDraftGuard({ dirty, pending = false }) {
  const registerSwitchGuard = useContext(HouseholdContext)?.registerSwitchGuard;
  useEffect(() => registerSwitchGuard?.({ dirty, pending }), [registerSwitchGuard, dirty, pending]);
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, pending]);
}
