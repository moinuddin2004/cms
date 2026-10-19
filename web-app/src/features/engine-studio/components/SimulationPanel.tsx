import { Fragment } from 'react'
import { ChevronRight, FlaskConical } from 'lucide-react'
import type { SimulationRun } from '../types'

/**
 * Test run (lab ERD §18): the shortest path from the initial state to each
 * terminal state, computed by the server without touching any data.
 */
export function SimulationPanel({
  runs,
  stale,
}: {
  runs: SimulationRun[]
  stale: boolean
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <FlaskConical className="size-4 text-text-3" /> Test run
      </h3>
      <p className="text-xs text-text-3">
        A fake item walked from the initial state to every terminal state — no
        real data or notifications.
        {stale && ' Save to re-run it on your latest edits.'}
      </p>
      {runs.length === 0 ? (
        <p className="mt-3 text-sm text-text-3">No terminal states yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {runs.map((r) => (
            <li
              key={r.terminal}
              className="flex flex-wrap items-center gap-1 text-sm"
            >
              <span className="w-40 shrink-0 font-mono text-xs font-medium">
                → {r.terminal}
              </span>
              {r.path === null ? (
                <span className="text-xs font-medium text-danger">
                  Unreachable from the initial state
                </span>
              ) : r.path.length === 0 ? (
                <span className="text-xs text-text-3">initial state</span>
              ) : (
                <span className="flex flex-wrap items-center gap-1 text-xs">
                  <code className="rounded bg-panel-2 px-1">
                    {r.path[0].from}
                  </code>
                  {r.path.map((step, i) => (
                    <Fragment key={i}>
                      <ChevronRight className="size-3 text-text-3" />
                      <span className="text-primary-text">{step.action}</span>
                      <ChevronRight className="size-3 text-text-3" />
                      <code className="rounded bg-panel-2 px-1">{step.to}</code>
                    </Fragment>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
