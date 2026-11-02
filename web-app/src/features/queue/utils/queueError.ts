import { formatTime } from '@/lib/datetime'

/** Error code + message from a queue API error (`{ message, error: { code, … } }`). */
export function queueError(err: unknown): {
  code?: string
  message: string
  data?: Record<string, any>
} {
  const res = (err as any)?.response?.data
  return {
    code: res?.error?.code,
    message:
      res?.message ||
      (err instanceof Error ? err.message : '') ||
      'Something went wrong',
    data: res?.error ?? undefined,
  }
}

/** "52 min" style elapsed label between two instants. */
export function minutesSince(
  from: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!from) return null
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(from).getTime()) / 60000),
  )
}

/** An instant on the clinic's clock, "9:30 AM". */
export function formatClock(iso: string | null | undefined): string {
  return formatTime(iso)
}
