import type { ApiResponse } from '@/core/types';
import { staffApi } from '@/staff/lib/api';

import type {
  ArrivalResult,
  BoardResponse,
  CallNextResult,
  CloseSessionInput,
  EntryResult,
  MutationOptions,
  NextPreview,
  PatientVisit,
  SessionResult,
  SessionSnapshot,
  TicketView,
  TransferResult,
  UrgentInput,
  WalkInInput,
} from '../types/queue.types';

/**
 * Queue endpoints (docs/07 §2.3). Reads take plain args. Every mutation takes
 * `(vars, { idempotencyKey, ifMatch? })`: the key is minted once per user tap
 * by `useIdempotentMutation` (retries reuse it), and `ifMatch` is the entry
 * version the screen shows. Callers never build headers themselves.
 */

type Method = 'post' | 'patch';

function mutationHeaders(opts: MutationOptions): Record<string, string> {
  const headers: Record<string, string> = { 'Idempotency-Key': opts.idempotencyKey };
  // Quoted ETag style; the backend strips `W/` and quotes before parsing.
  if (opts.ifMatch !== undefined) headers['If-Match'] = `"${opts.ifMatch}"`;
  return headers;
}

async function mutate<T>(
  method: Method,
  url: string,
  body: object,
  opts: MutationOptions,
): Promise<T> {
  const res = await staffApi.request<ApiResponse<T>>({
    method,
    url,
    // The backend hashes the body with the key — always send an object.
    data: body,
    headers: mutationHeaders(opts),
  });
  return res.data.data;
}

const id = encodeURIComponent;

// ─── Reads ───────────────────────────────────────────────────────

/** The signed-in doctor's queue for today (the server creates it if missing). */
export async function fetchMySession(): Promise<SessionSnapshot> {
  const res = await staffApi.get<ApiResponse<SessionSnapshot>>('/queue/my-session');
  return res.data.data;
}

/** Reception board: every doctor's lane for `date` (YYYY-MM-DD, default today). */
export async function fetchBoard(date?: string): Promise<BoardResponse> {
  const res = await staffApi.get<ApiResponse<BoardResponse>>('/queue/sessions', {
    params: date ? { date } : undefined,
  });
  return res.data.data;
}

export async function fetchSession(sessionId: string): Promise<SessionSnapshot> {
  const res = await staffApi.get<ApiResponse<SessionSnapshot>>(
    `/queue/sessions/${id(sessionId)}`,
  );
  return res.data.data;
}

export async function fetchNextPreview(sessionId: string): Promise<NextPreview> {
  const res = await staffApi.get<ApiResponse<NextPreview>>(
    `/queue/sessions/${id(sessionId)}/next-preview`,
  );
  return res.data.data;
}

export async function fetchTicket(entryId: string): Promise<TicketView> {
  const res = await staffApi.get<ApiResponse<TicketView>>(
    `/queue/entries/${id(entryId)}/ticket`,
  );
  return res.data.data;
}

export async function fetchPatientVisits(patientId: string): Promise<PatientVisit[]> {
  const res = await staffApi.get<ApiResponse<PatientVisit[]>>(
    `/queue/patients/${id(patientId)}/visits`,
  );
  return res.data.data;
}

// ─── Session (doctor) ────────────────────────────────────────────

export function startSession(vars: { sessionId: string }, opts: MutationOptions) {
  return mutate<SessionResult>('patch', `/queue/sessions/${id(vars.sessionId)}/start`, {}, opts);
}

export function pauseSession(vars: { sessionId: string; reason: string }, opts: MutationOptions) {
  return mutate<SessionResult>(
    'patch',
    `/queue/sessions/${id(vars.sessionId)}/pause`,
    { reason: vars.reason },
    opts,
  );
}

export function resumeSession(vars: { sessionId: string }, opts: MutationOptions) {
  return mutate<SessionResult>('patch', `/queue/sessions/${id(vars.sessionId)}/resume`, {}, opts);
}

export function closeSession(
  vars: { sessionId: string } & CloseSessionInput,
  opts: MutationOptions,
) {
  return mutate<SessionResult>(
    'patch',
    `/queue/sessions/${id(vars.sessionId)}/close`,
    { decisions: vars.decisions },
    opts,
  );
}

/** Smart order on/off — needs `queue.entry.reprioritize`. */
export function setSessionMode(
  vars: { sessionId: string; smartQueueEnabled: boolean },
  opts: MutationOptions,
) {
  return mutate<SessionResult>(
    'patch',
    `/queue/sessions/${id(vars.sessionId)}/mode`,
    { smartQueueEnabled: vars.smartQueueEnabled },
    opts,
  );
}

export function callNext(vars: { sessionId: string }, opts: MutationOptions) {
  return mutate<CallNextResult>(
    'post',
    `/queue/sessions/${id(vars.sessionId)}/call-next`,
    {},
    opts,
  );
}

/**
 * Reception: open a doctor's lane for today (`doctorId` defaults to the caller).
 * The backend does not read an Idempotency-Key here (it is a get-or-create),
 * but sending one is harmless and keeps every mutation uniform.
 */
export function openSession(vars: { doctorId?: string }, opts: MutationOptions) {
  return mutate<SessionSnapshot>('post', '/queue/sessions', { doctorId: vars.doctorId }, opts);
}

// ─── Entry actions (doctor) ──────────────────────────────────────

export function selectEntry(vars: { entryId: string; reason?: string }, opts: MutationOptions) {
  return mutate<EntryResult>(
    'patch',
    `/queue/entries/${id(vars.entryId)}/select`,
    { reason: vars.reason },
    opts,
  );
}

export function recallEntry(vars: { entryId: string }, opts: MutationOptions) {
  return mutate<EntryResult>('patch', `/queue/entries/${id(vars.entryId)}/recall`, {}, opts);
}

export function undoCall(vars: { entryId: string }, opts: MutationOptions) {
  return mutate<EntryResult>('patch', `/queue/entries/${id(vars.entryId)}/undo-call`, {}, opts);
}

export function skipEntry(vars: { entryId: string }, opts: MutationOptions) {
  return mutate<EntryResult>('patch', `/queue/entries/${id(vars.entryId)}/skip`, {}, opts);
}

export function startConsultation(vars: { entryId: string }, opts: MutationOptions) {
  return mutate<EntryResult>(
    'patch',
    `/queue/entries/${id(vars.entryId)}/start-consultation`,
    {},
    opts,
  );
}

export function sendForTest(vars: { entryId: string; reason?: string }, opts: MutationOptions) {
  return mutate<EntryResult>(
    'patch',
    `/queue/entries/${id(vars.entryId)}/send-for-test`,
    { reason: vars.reason },
    opts,
  );
}

export function completeEntry(vars: { entryId: string }, opts: MutationOptions) {
  return mutate<EntryResult>('patch', `/queue/entries/${id(vars.entryId)}/complete`, {}, opts);
}

export function abortEntry(vars: { entryId: string; reason?: string }, opts: MutationOptions) {
  return mutate<EntryResult>(
    'patch',
    `/queue/entries/${id(vars.entryId)}/abort`,
    { reason: vars.reason },
    opts,
  );
}

// ─── Entry actions (reception) ───────────────────────────────────

export function cancelEntry(vars: { entryId: string; reason?: string }, opts: MutationOptions) {
  return mutate<EntryResult>(
    'patch',
    `/queue/entries/${id(vars.entryId)}/cancel`,
    { reason: vars.reason },
    opts,
  );
}

export function rejoinEntry(
  vars: { entryId: string; placeAfterEntryId?: string },
  opts: MutationOptions,
) {
  return mutate<EntryResult>(
    'patch',
    `/queue/entries/${id(vars.entryId)}/rejoin`,
    { placeAfterEntryId: vars.placeAfterEntryId },
    opts,
  );
}

export function returnFromTest(vars: { entryId: string }, opts: MutationOptions) {
  return mutate<EntryResult>(
    'patch',
    `/queue/entries/${id(vars.entryId)}/return-from-test`,
    {},
    opts,
  );
}

export function transferEntry(
  vars: { entryId: string; toDoctorId: string; reason?: string },
  opts: MutationOptions,
) {
  return mutate<TransferResult>(
    'patch',
    `/queue/entries/${id(vars.entryId)}/transfer`,
    { toDoctorId: vars.toDoctorId, reason: vars.reason },
    opts,
  );
}

/** Mark urgent — the reason is required by the server. */
export function setPriority(vars: { entryId: string; reason: string }, opts: MutationOptions) {
  return mutate<EntryResult>(
    'patch',
    `/queue/entries/${id(vars.entryId)}/priority`,
    { reason: vars.reason },
    opts,
  );
}

// ─── Arrivals ────────────────────────────────────────────────────

export function registerWalkIn(vars: WalkInInput, opts: MutationOptions) {
  return mutate<ArrivalResult>('post', '/queue/walk-ins', vars, opts);
}

export function checkInAppointment(
  vars: { appointmentId: string } & UrgentInput,
  opts: MutationOptions,
) {
  return mutate<ArrivalResult>(
    'patch',
    `/appointments/${id(vars.appointmentId)}/check-in`,
    { urgentReason: vars.urgentReason },
    opts,
  );
}

export function convertToWalkIn(
  vars: { appointmentId: string } & UrgentInput,
  opts: MutationOptions,
) {
  return mutate<ArrivalResult>(
    'post',
    `/appointments/${id(vars.appointmentId)}/convert-to-walk-in`,
    { urgentReason: vars.urgentReason },
    opts,
  );
}
