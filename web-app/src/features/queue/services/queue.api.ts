import type { AxiosError } from 'axios'
import api from '@/lib/api'
import type {
  ArrivalResult,
  CallNextResult,
  CloseDecision,
  DisplayState,
  EntryResult,
  PatientVisit,
  QueueBoardData,
  QueuePolicySettings,
  QueueSession,
  QueueTicket,
  SessionSnapshot,
} from '../types'

// ─── Mutation transport ─────────────────────────────────────────────

const LOCK_RETRIES = 5

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Every queue change carries an Idempotency-Key (one per user action). On
 * 503 LOCK_TIMEOUT — or a lost connection — the SAME key is retried, so a
 * check-in whose reply was lost returns the same token instead of a new one.
 * `ifMatch` sends the entry version so a stale screen can't act on a patient
 * someone else already moved (409 VERSION_CONFLICT).
 */
async function mutate<T>(
  method: 'post' | 'patch' | 'delete',
  url: string,
  body?: unknown,
  opts: { ifMatch?: number } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Idempotency-Key': newKey() }
  if (opts.ifMatch !== undefined) headers['If-Match'] = String(opts.ifMatch)

  for (let attempt = 0; ; attempt++) {
    try {
      const { data } = await api.request({
        method,
        url,
        data: body ?? {},
        headers,
      })
      return data.data as T
    } catch (err) {
      const e = err as AxiosError<any>
      const retryable =
        (e.response?.status === 503 &&
          e.response.data?.error?.code === 'LOCK_TIMEOUT') ||
        (!e.response && e.code !== 'ERR_CANCELED')
      if (!retryable || attempt >= LOCK_RETRIES) throw err
      await new Promise((r) =>
        setTimeout(r, 250 * (attempt + 1) + Math.random() * 250),
      )
    }
  }
}

// ─── Reads ──────────────────────────────────────────────────────────

export interface QueueMe {
  roles: ('clinic_admin' | 'receptionist' | 'doctor')[]
  /** The user's employee id at this location (their doctor id, if a doctor). */
  employeeId: string | null
}

/** The signed-in user's clinic roles at the active location. */
export async function fetchQueueMe(): Promise<QueueMe> {
  const { data } = await api.get('/queue/me')
  return data.data
}

/** Reception board: every doctor's lane for a service date (default today). */
export async function fetchQueueBoard(date?: string): Promise<QueueBoardData> {
  const { data } = await api.get('/queue/sessions', { params: { date } })
  return data.data
}

export async function fetchSessionSnapshot(
  sessionId: string,
): Promise<SessionSnapshot> {
  const { data } = await api.get(`/queue/sessions/${sessionId}`)
  return data.data
}

/** The signed-in doctor's queue for today (created on first open). */
export async function fetchMySession(
  doctorId?: string,
): Promise<SessionSnapshot> {
  const { data } = await api.get('/queue/my-session', { params: { doctorId } })
  return data.data
}

export async function fetchTicket(entryId: string): Promise<QueueTicket> {
  const { data } = await api.get(`/queue/entries/${entryId}/ticket`)
  return data.data
}

export async function fetchPatientVisits(
  patientId: string,
): Promise<PatientVisit[]> {
  const { data } = await api.get(`/queue/patients/${patientId}/visits`)
  return data.data
}

/** TV display — public, no login. */
export async function fetchDisplayState(
  locationId: string,
): Promise<DisplayState> {
  const { data } = await api.get(`/queue/displays/${locationId}/state`)
  return data.data
}

export async function fetchQueuePolicies(): Promise<QueuePolicySettings> {
  const { data } = await api.get('/queue/policies')
  return data.data
}

// ─── Arrivals ───────────────────────────────────────────────────────

export function checkInAppointment(
  appointmentId: string,
  urgentReason?: string,
) {
  return mutate<ArrivalResult>(
    'patch',
    `/appointments/${appointmentId}/check-in`,
    {
      urgentReason: urgentReason || undefined,
    },
  )
}

export function convertToWalkIn(appointmentId: string) {
  return mutate<ArrivalResult>(
    'post',
    `/appointments/${appointmentId}/convert-to-walk-in`,
    {},
  )
}

export interface WalkInPayload {
  doctorId: string
  patientId?: string
  patientName?: string
  patientPhone?: string
  reasonForVisit?: string
  urgentReason?: string
  force?: boolean
}

export function registerWalkIn(payload: WalkInPayload) {
  return mutate<ArrivalResult>('post', '/queue/walk-ins', payload)
}

/** Open a doctor's lane for today before anyone checks in. */
export function ensureSession(doctorId?: string) {
  return mutate<SessionSnapshot>('post', '/queue/sessions', { doctorId })
}

// ─── Doctor ─────────────────────────────────────────────────────────

export function callNext(sessionId: string) {
  return mutate<CallNextResult>(
    'post',
    `/queue/sessions/${sessionId}/call-next`,
  )
}

type EntryAction =
  | 'recall'
  | 'undo-call'
  | 'skip'
  | 'start-consultation'
  | 'complete'
  | 'return-from-test'
  | 'force-complete'

export function entryAction(
  entryId: string,
  action: EntryAction,
  version?: number,
) {
  return mutate<EntryResult>(
    'patch',
    `/queue/entries/${entryId}/${action}`,
    {},
    { ifMatch: version },
  )
}

export function selectPatient(
  entryId: string,
  version: number,
  reason?: string,
) {
  return mutate<CallNextResult>(
    'patch',
    `/queue/entries/${entryId}/select`,
    { reason: reason || undefined },
    { ifMatch: version },
  )
}

export function sendForTest(entryId: string, version: number, reason?: string) {
  return mutate<EntryResult>(
    'patch',
    `/queue/entries/${entryId}/send-for-test`,
    { reason },
    { ifMatch: version },
  )
}

export function abortConsultation(
  entryId: string,
  version: number,
  reason?: string,
) {
  return mutate<EntryResult>(
    'patch',
    `/queue/entries/${entryId}/abort`,
    { reason },
    { ifMatch: version },
  )
}

type SessionAction = 'start' | 'resume'

export function sessionAction(sessionId: string, action: SessionAction) {
  return mutate<{ session: QueueSession }>(
    'patch',
    `/queue/sessions/${sessionId}/${action}`,
  )
}

export function pauseSession(sessionId: string, reason: string) {
  return mutate<{ session: QueueSession }>(
    'patch',
    `/queue/sessions/${sessionId}/pause`,
    { reason },
  )
}

export function closeSession(sessionId: string, decisions: CloseDecision[]) {
  return mutate<{ session: QueueSession }>(
    'patch',
    `/queue/sessions/${sessionId}/close`,
    { decisions },
  )
}

export function setSessionMode(sessionId: string, smartQueueEnabled: boolean) {
  return mutate<{ session: QueueSession }>(
    'patch',
    `/queue/sessions/${sessionId}/mode`,
    { smartQueueEnabled },
  )
}

// ─── Reception ──────────────────────────────────────────────────────

export function cancelEntry(entryId: string, version: number, reason?: string) {
  return mutate<EntryResult>(
    'patch',
    `/queue/entries/${entryId}/cancel`,
    { reason },
    { ifMatch: version },
  )
}

export function rejoinEntry(
  entryId: string,
  version: number,
  placeAfterEntryId?: string,
) {
  return mutate<EntryResult>(
    'patch',
    `/queue/entries/${entryId}/rejoin`,
    { placeAfterEntryId },
    { ifMatch: version },
  )
}

export function transferEntry(
  entryId: string,
  version: number,
  toDoctorId: string,
  reason?: string,
) {
  return mutate<ArrivalResult & { from: unknown }>(
    'patch',
    `/queue/entries/${entryId}/transfer`,
    { toDoctorId, reason },
    { ifMatch: version },
  )
}

export function setUrgentPriority(
  entryId: string,
  version: number,
  reason: string,
) {
  return mutate<EntryResult>(
    'patch',
    `/queue/entries/${entryId}/priority`,
    { reason },
    { ifMatch: version },
  )
}

// ─── Settings ───────────────────────────────────────────────────────

export type QueuePolicyUpdate = Partial<
  Omit<QueuePolicySettings['effective'], 'timezone' | 'source'>
> & { scope: 'location' | 'organization'; version?: number }

export async function updateQueuePolicies(
  payload: QueuePolicyUpdate,
): Promise<QueuePolicySettings> {
  const { data } = await api.patch('/queue/policies', payload)
  return data.data
}

export async function removeLocationOverride(): Promise<QueuePolicySettings> {
  const { data } = await api.delete('/queue/policies/location')
  return data.data
}
