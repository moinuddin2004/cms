import { useAccess } from '@/staff/features/access';

import { availableEntryActions, type EntryActionId, type EntryViewer } from '../lib/entry-actions';
import type { EntryView, SessionView } from '../types/queue.types';

/** The actions this user may take on `entry` right now (status x permission). */
export function useEntryActions(
  entry: EntryView,
  session: SessionView,
  viewer: EntryViewer,
): EntryActionId[] {
  const { can } = useAccess();
  return availableEntryActions(entry, session, can, viewer);
}
