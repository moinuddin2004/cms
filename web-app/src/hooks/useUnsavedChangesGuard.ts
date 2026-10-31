import { useBlocker } from '@tanstack/react-router'

/**
 * Holds in-app navigation while `dirty` (the page shows a confirm dialog from
 * `status`/`proceed`/`reset`) and asks the browser before unload.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  return useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: () => dirty,
    withResolver: true,
  })
}
