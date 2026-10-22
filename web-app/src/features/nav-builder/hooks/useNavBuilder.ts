import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_NAV_LAYOUT } from '@/features/access'
import type { NavLayout } from '@/features/access'
import { fromLayout, sameLayout, toLayout } from '../lib/builder-state'
import type { BuilderState } from '../lib/builder-state'

export type BuilderUpdate = (fn: (state: BuilderState) => BuilderState) => void

/**
 * Draft of the clinic layout. `saved` null = the clinic uses the code
 * default. The draft resets whenever the saved layout itself changes (after
 * a save / reset / another admin's edit), not on a refetch of the same data.
 */
export function useNavBuilder(saved: NavLayout | null) {
  const baseline = useMemo(
    () => toLayout(fromLayout(saved ?? DEFAULT_NAV_LAYOUT)),
    [saved],
  )
  const baselineKey = JSON.stringify(baseline)
  const [state, setState] = useState(() => fromLayout(baseline))

  useEffect(() => {
    setState(fromLayout(JSON.parse(baselineKey) as NavLayout))
  }, [baselineKey])

  const layout = useMemo(() => toLayout(state), [state])
  const isDirty = !sameLayout(layout, baseline)

  const update = useCallback<BuilderUpdate>((fn) => setState(fn), [])
  const discard = useCallback(
    () => setState(fromLayout(JSON.parse(baselineKey) as NavLayout)),
    [baselineKey],
  )

  return { state, update, layout, isDirty, discard }
}
