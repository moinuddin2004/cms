import type { ReminderContent } from './reminder-content';
import type { ReminderRequest } from './plan-reminders';

/**
 * Keeps the OS's pending local notifications equal to the plan (docs/02 §8). The OS-facing part is
 * a small port so the diff and the ordering are testable without native code; `expo-reminder-port.ts`
 * is the real implementation.
 */
export const REMINDER_ID_PREFIX = 'dose.';

export interface ScheduledReminder {
  id: string;
  fireAtMs: number;
  title: string;
  body: string;
  /** Routing hint only, no clinical text (docs/02 §8). */
  data: Record<string, string>;
}

export interface ReminderPort {
  /** Identifiers of every pending notification of the app (all kinds). */
  listPendingIds(): Promise<string[]>;
  schedule(reminder: ScheduledReminder): Promise<void>;
  cancel(id: string): Promise<void>;
}

/** djb2 → base36. Not security, just "did the text change". */
export function contentHash(content: ReminderContent): string {
  let h = 5381;
  const s = `${content.title}\u0000${content.body}`;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** `dose.<scheduleId>.<dueMs>.<hash>` — the text is part of the id, so a changed text is "new". */
export const notificationId = (request: ReminderRequest, content: ReminderContent) =>
  `${request.id}.${contentHash(content)}`;

export const isDoseReminderId = (id: string) => id.startsWith(REMINDER_ID_PREFIX);

/** Pure diff: what to cancel (ours, no longer planned) and what to add (planned, not pending). Other notifications are never touched. */
export function diffReminders(
  plannedIds: readonly string[],
  pendingIds: readonly string[],
): { cancel: string[]; add: string[] } {
  const planned = new Set(plannedIds);
  const pending = new Set(pendingIds);
  return {
    cancel: pendingIds.filter((id) => isDoseReminderId(id) && !planned.has(id)),
    add: plannedIds.filter((id) => !pending.has(id)),
  };
}

export interface SyncResult {
  cancelled: number;
  scheduled: number;
}

/**
 * One reconciliation pass: cancel stale ids first (so a changed dose never rings twice), then
 * schedule the missing ones. A failure on one notification does not stop the rest; the next pass
 * (start, foreground, data change) retries it because the diff is recomputed from the OS state.
 */
export async function syncReminders(port: ReminderPort, planned: readonly ScheduledReminder[]): Promise<SyncResult> {
  const pending = await port.listPendingIds();
  const { cancel, add } = diffReminders(
    planned.map((p) => p.id),
    pending,
  );
  let cancelled = 0;
  for (const id of cancel) {
    try {
      await port.cancel(id);
      cancelled += 1;
    } catch {
      // retried next pass
    }
  }
  const byId = new Map(planned.map((p) => [p.id, p]));
  let scheduled = 0;
  for (const id of add) {
    try {
      await port.schedule(byId.get(id)!);
      scheduled += 1;
    } catch {
      // retried next pass
    }
  }
  return { cancelled, scheduled };
}

/** Cancels every dose reminder (sign-out, "reminders off"); other notifications stay. */
export async function cancelAllDoseReminders(port: ReminderPort): Promise<void> {
  const ids = (await port.listPendingIds()).filter(isDoseReminderId);
  for (const id of ids) {
    try {
      await port.cancel(id);
    } catch {
      // best effort
    }
  }
}

/** Turns a plan into scheduler input using `toContent` for the text. */
export function toScheduled(
  requests: readonly ReminderRequest[],
  toContent: (r: ReminderRequest) => ReminderContent,
): ScheduledReminder[] {
  return requests.map((r) => {
    const content = toContent(r);
    return {
      id: notificationId(r, content),
      fireAtMs: r.fireAtMs,
      title: content.title,
      body: content.body,
      data: { space: 'patient', type: 'medication.dose', route: '/today', entityId: r.scheduleId },
    };
  });
}

// ==================== serialised entry point ====================

let chain: Promise<unknown> = Promise.resolve();

/** Runs passes one after another (start, foreground and data changes can overlap). */
export function runSerialised<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.catch(() => undefined);
  return next;
}
