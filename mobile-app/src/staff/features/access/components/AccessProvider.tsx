import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { createAccessChecks, type AccessChecks } from '../lib/access';
import { useMyAccess } from '../hooks/useMyAccess';

/** `disabled`: no active location · `loading` / `error` / `ready`: the `/me/access` query. */
export type AccessStatus = 'disabled' | 'loading' | 'error' | 'ready';

export interface AccessContextValue extends AccessChecks {
  status: AccessStatus;
  isSuperAdmin: boolean;
  isOwner: boolean;
  employeeId: string | null;
  homeRoute: string | null;
  refetch: () => void;
}

const DISABLED: AccessContextValue = {
  ...createAccessChecks(undefined),
  status: 'disabled',
  isSuperAdmin: false,
  isOwner: false,
  employeeId: null,
  homeRoute: null,
  refetch: () => {},
};

const AccessContext = createContext<AccessContextValue>(DISABLED);

/** The one question the UI asks: `can(perm)`. */
export const useAccess = () => useContext(AccessContext);

/** Loads `/me/access` for the active org + location; mount under signed-in routes only. */
export function AccessProvider({ children }: { children: ReactNode }) {
  const { data, isError, refetch } = useMyAccess();

  const value = useMemo<AccessContextValue>(
    () => ({
      ...createAccessChecks(data),
      status: data ? 'ready' : isError ? 'error' : 'loading',
      isSuperAdmin: data?.isSuperAdmin ?? false,
      isOwner: data?.isOwner ?? false,
      employeeId: data?.employeeId ?? null,
      homeRoute: data?.homeRoute ?? null,
      refetch: () => void refetch(),
    }),
    [data, isError, refetch],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}
