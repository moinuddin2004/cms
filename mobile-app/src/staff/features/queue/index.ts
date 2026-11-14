// Public barrel of the queue feature: data layer (M1-07a) and hooks (M1-07). Screens arrive in M1-08 / M1-09.
export * from './api/queue.api';
export { queueKeys } from './api/queue.keys';
export { availableEntryActions } from './lib/entry-actions';
export type { CanFn, EntryActionId, EntryViewer } from './lib/entry-actions';
export { queueErrorCode, queueErrorMessage, shouldRefetch } from './lib/queue-errors';
export type * from './types/queue.types';
export { useMySession } from './hooks/useMySession';
export { useBoard } from './hooks/useBoard';
export { useSession } from './hooks/useSession';
export { useTicket } from './hooks/useTicket';
export { usePatientQueueVisits } from './hooks/usePatientQueueVisits';
export { useEntryActions } from './hooks/useEntryActions';
export type { EntryVars } from './hooks/queue-mutation';
export * from './hooks/useSessionMutations';
export * from './hooks/useEntryMutations';
export * from './hooks/useArrivalMutations';
