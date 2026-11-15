import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Hourglass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/feedback/LoadingSkeleton'
import { formatTime } from '@/lib/datetime'
import { PublicShell } from '../components/PublicShell'
import { fetchVisitState } from '../services/visit.api'
import { isVisitTokenShape } from '../utils/links'

/**
 * `/v/$token` — live visit state (queue position), no personal data. Built
 * against the documented M3-05 contract; until that endpoint exists the page
 * shows a "coming soon" state.
 */
export function VisitStatePage({ token }: { token: string }) {
  const valid = isVisitTokenShape(token)
  const state = useQuery({
    queryKey: ['visit-state', token],
    queryFn: () => fetchVisitState(token),
    enabled: valid,
    retry: false,
    refetchInterval: (q) => (q.state.data ? 10_000 : false),
  })

  if (!valid) {
    return (
      <PublicShell>
        <h1 className="text-lg font-semibold">This link isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask the clinic for your visit link again.
        </p>
      </PublicShell>
    )
  }

  if (state.isLoading) {
    return (
      <PublicShell>
        <LoadingSkeleton variant="detail" />
      </PublicShell>
    )
  }

  const status = isAxiosError(state.error)
    ? state.error.response?.status
    : undefined

  if (!state.data && (status === 400 || status === 410)) {
    return (
      <PublicShell>
        <h1 className="text-lg font-semibold">
          This link is invalid or expired
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask the clinic for your visit link again.
        </p>
      </PublicShell>
    )
  }

  if (!state.data && status !== 404) {
    return (
      <PublicShell>
        <h1 className="text-lg font-semibold">Couldn&apos;t load your visit</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Check your connection and try again.
        </p>
        <Button
          className="mt-4"
          onClick={() => void state.refetch()}
          disabled={state.isFetching}
        >
          Retry
        </Button>
      </PublicShell>
    )
  }

  if (!state.data) {
    return (
      <PublicShell>
        <Hourglass className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">
          Visit status — coming soon
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live visit tracking isn&apos;t available yet. Please check with the
          front desk.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => void state.refetch()}
          disabled={state.isFetching}
        >
          Try again
        </Button>
      </PublicShell>
    )
  }

  const v = state.data
  return (
    <PublicShell>
      <p className="text-sm text-muted-foreground">
        {v.clinicName} · {v.locationName}
      </p>
      <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
        Your token
      </p>
      <p className="text-4xl font-semibold tabular-nums">{v.token}</p>
      <p className="mt-3 text-base font-medium capitalize">
        {v.status.replace(/_/g, ' ').toLowerCase()}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-muted p-3">
          <dt className="text-muted-foreground">People ahead</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {v.peopleAhead ?? '—'}
          </dd>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <dt className="text-muted-foreground">Now serving</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {v.nowServingToken ?? '—'}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">
        Updated {formatTime(v.updatedAt)}
      </p>
    </PublicShell>
  )
}
