/** Query keys for the queue feature. Always start with `'queue'`. */
export const queueKeys = {
  all: ['queue'] as const,
  mySession: (locationId: string, ymd: string) =>
    ['queue', 'my-session', locationId, ymd] as const,
  mySessionAll: () => ['queue', 'my-session'] as const,
  boardAll: () => ['queue', 'board'] as const,
  board: (locationId: string, ymd: string) => ['queue', 'board', locationId, ymd] as const,
  session: (id: string) => ['queue', 'session', id] as const,
  nextPreview: (sessionId: string) => ['queue', 'next-preview', sessionId] as const,
  ticket: (entryId: string) => ['queue', 'ticket', entryId] as const,
  patientVisits: (patientId: string) => ['queue', 'patient-visits', patientId] as const,
};
