import { AppState } from 'react-native';

/**
 * Privacy-safe product analytics client (M2-13, docs/analytics-events.md).
 *
 * `createTracker` batches events in memory and hands them to an injected
 * `send` (each space provides its own, so core imports neither space). It is
 * fire-and-forget: `track()` never throws and never blocks the UI; a failed
 * send (offline, 5xx, 429) keeps the batch and retries with backoff; a
 * rejected one (other 4xx, e.g. signed out) drops it. The queue is capped.
 * Events are in memory only: closing the app before a flush loses them, which
 * is fine for product metrics and keeps nothing on disk. A queued event remembers who
 * it belongs to (getActor at 	rack() time); a batch is only sent while that same
 * actor is signed in, so nothing is ever sent under the next account's token.
 * The app going to the background flushes the queue.
 *
 * Props are scalars from the documented allow-list. NEVER pass names, phones,
 * emails, ids of people or records, free text, or anything about health.
 * The server drops everything not on its allow-list anyway.
 */
export type EventProps = Record<string, string | boolean>;

export interface TrackedEvent<N extends string = string> {
  name: N;
  props?: EventProps;
  /** ISO time on the phone. */
  at: string;
}

export interface TrackerOptions<N extends string> {
  /** Id of the signed-in account/user now, or null when signed out. */
  getActor: () => string | null;
  send: (events: TrackedEvent<N>[]) => Promise<void>;
  /** Wait before a flush so events batch up. Default 5 s. */
  flushDelayMs?: number;
  /** Events per request (server cap is 50). Default 20. */
  maxBatch?: number;
  /** Oldest events are dropped beyond this. Default 200. */
  maxQueue?: number;
  /** Off in tests; defaults to "not under Jest". */
  enabled?: boolean;
  /** Flush when the app leaves the foreground. Default true (when enabled). */
  flushOnBackground?: boolean;
}

export interface Tracker<N extends string> {
  track: (name: N, props?: EventProps) => void;
  /** Send what is queued now (also used when the app goes to background). */
  flush: () => Promise<void>;
  /** Forget queued events (sign-out). */
  clear: () => void;
}

const MAX_BACKOFF_MS = 5 * 60 * 1000;

function shouldRetry(err: unknown): boolean {
  const status = (err as { response?: { status?: number } } | null)?.response?.status;
  if (status === undefined) return true; // network error / timeout
  return status >= 500 || status === 429 || status === 408;
}

interface Queued<N extends string> {
  actor: string;
  event: TrackedEvent<N>;
}

export function createTracker<N extends string>(options: TrackerOptions<N>): Tracker<N> {
  const {
    send,
    flushDelayMs = 5000,
    maxBatch = 20,
    maxQueue = 200,
    enabled = process.env.JEST_WORKER_ID === undefined,
    flushOnBackground = true,
    getActor,
  } = options;

  let queue: Queued<N>[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sending = false;
  let failures = 0;

  const schedule = (delay: number) => {
    if (timer || !enabled) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delay);
  };

  async function flush(): Promise<void> {
    if (!enabled || sending || queue.length === 0) return;
    // Drop whatever belongs to someone who is no longer signed in.
    const actor = getActor();
    queue = actor === null ? [] : queue.filter((q) => q.actor === actor);
    if (queue.length === 0) return;
    sending = true;
    const batch = queue.slice(0, maxBatch);
    try {
      await send(batch.map((q) => q.event));
      queue = queue.slice(batch.length);
      failures = 0;
    } catch (err) {
      if (shouldRetry(err)) {
        failures += 1;
      } else {
        queue = queue.slice(batch.length); // the server will never accept these
        failures = 0;
      }
    } finally {
      sending = false;
    }
    if (queue.length > 0) {
      schedule(failures > 0 ? Math.min(flushDelayMs * 2 ** failures, MAX_BACKOFF_MS) : flushDelayMs);
    }
  }

  if (enabled && flushOnBackground) {
    AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flush();
    });
  }

  return {
    track(name, props) {
      if (!enabled) return;
      try {
        const actor = getActor();
        if (actor === null) return;
        queue.push({ actor, event: { name, props, at: new Date().toISOString() } });
        if (queue.length > maxQueue) queue = queue.slice(queue.length - maxQueue);
        schedule(flushDelayMs);
      } catch {
        // analytics must never affect the app
      }
    },
    flush,
    clear() {
      queue = [];
      failures = 0;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

