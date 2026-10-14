import { useCallback, useEffect, useRef, useState } from 'react'
import type { SaveState } from '../types'

/**
 * Saves `value` a moment after the doctor stops typing, so there is no Save
 * button to remember. Nothing is sent for the value the screen loaded with,
 * a pending change is flushed when the screen closes, and a failed save is
 * retried on the next edit.
 *
 * `save` may be a fresh closure each render — the latest one is always used.
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<unknown>,
  { delay = 800, enabled = true }: { delay?: number; enabled?: boolean } = {},
) {
  const [state, setState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const saveRef = useRef(save)
  saveRef.current = save
  const latest = useRef(value)
  latest.current = value
  // JSON of the last value known to be on the server (or the loaded value).
  const synced = useRef<string | null>(null)
  const inFlight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Resolves true when the server is up to date, false when the save failed. */
  const run = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) {
      // Another save is running — try again once it lands.
      timer.current = setTimeout(() => void run(), 300)
      return true
    }
    const snapshot = JSON.stringify(latest.current)
    if (snapshot === synced.current) return true
    inFlight.current = true
    setState('saving')
    try {
      await saveRef.current(latest.current)
      synced.current = snapshot
      setSavedAt(new Date())
      setState('saved')
      return true
    } catch {
      setState('error')
      return false
    } finally {
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const snapshot = JSON.stringify(value)
    if (synced.current === null) {
      // First value after the screen is ready = what the server already has.
      synced.current = snapshot
      return
    }
    if (snapshot === synced.current) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void run(), delay)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [value, enabled, delay, run])

  // Leaving the screen with an unsaved change: save it now.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      if (
        synced.current !== null &&
        JSON.stringify(latest.current) !== synced.current
      ) {
        void saveRef.current(latest.current).catch(() => undefined)
      }
    },
    [],
  )

  /** Save right now (e.g. before Complete or Finalize); false if it failed. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current)
    while (inFlight.current) await new Promise((r) => setTimeout(r, 100))
    return run()
  }, [run])

  return { state, savedAt, flush }
}
