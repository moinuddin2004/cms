import { useEffect, useState } from 'react'
import { Loader2, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { inClinic } from '@/lib/datetime'
import { useDisplayState } from '../hooks/useQueueData'

/**
 * Waiting-room TV. Shows, per doctor, the token being served and the next
 * few tokens — never patient names. Needs no login; updates live over the
 * display room and polls every 10 s if the connection drops.
 */
export function DisplayPage({ locationId }: { locationId: string }) {
  const { data, isLoading, isError, live } = useDisplayState(locationId)
  const [clock, setClock] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 15_000)
    return () => clearInterval(t)
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <Loader2 className="size-10 animate-spin" />
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-slate-300">
        <WifiOff className="size-10" />
        <p className="text-xl">Display not available for this location</p>
      </div>
    )
  }

  const doctors = data.doctors.filter((d) => d.status !== 'closed')

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white md:p-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {data.locationName}
          </h1>
          <p className="mt-1 text-lg text-slate-400">
            Please wait for your token
          </p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-semibold tabular-nums md:text-5xl">
            {format(clock, 'h:mm a', inClinic(data.timezone))}
          </p>
          {!live && <p className="text-sm text-amber-400">Reconnecting…</p>}
        </div>
      </header>

      {doctors.length === 0 ? (
        <p className="mt-24 text-center text-2xl text-slate-400">
          No doctors are seeing patients right now.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {doctors.map((d) => (
            <section
              key={d.sessionId}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="truncate text-2xl font-semibold">
                  Dr. {d.doctorName}
                </h2>
                {d.status !== 'open' && (
                  <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm text-amber-300">
                    {d.status === 'paused' ? 'On a break' : 'Starting soon'}
                  </span>
                )}
              </div>
              <p className="mt-6 text-sm uppercase tracking-widest text-slate-400">
                Now serving
              </p>
              <p
                className={cn(
                  'mt-1 font-mono text-7xl font-extrabold tabular-nums md:text-8xl',
                  d.nowServing?.status === 'called'
                    ? 'animate-pulse text-emerald-400'
                    : 'text-white',
                )}
              >
                {d.nowServing?.token ?? '—'}
              </p>
              {d.nowServing?.status === 'called' && (
                <p className="mt-1 text-lg text-emerald-300">
                  Please go to the doctor
                </p>
              )}
              <p className="mt-6 text-sm uppercase tracking-widest text-slate-400">
                Next
              </p>
              <p className="mt-1 font-mono text-3xl tabular-nums text-slate-200">
                {d.next.length ? d.next.join('   ') : '—'}
              </p>
              <p className="mt-4 text-sm text-slate-500">
                {d.waitingCount} waiting
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
