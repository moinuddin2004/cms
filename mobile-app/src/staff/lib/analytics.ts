import { createTracker } from '@/core/analytics';
import { staffApi } from '@/staff/lib/api';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

/** Staff product events (M2-13): names/props are the allow-list in docs/analytics-events.md. */
export type StaffEventName = 'staff_signed_in' | 'staff_checked_in' | 'staff_called_next';

const tracker = createTracker<StaffEventName>({
  getActor: () => useStaffAuthStore.getState().user?.uuid || null,
  send: async (events) => {
    await staffApi.post('/me/events', { events });
  },
});

export const trackStaff = tracker.track;
export const flushStaffEvents = tracker.flush;
/** Forget queued events: first thing in sign-out. */
export const clearStaffEvents = tracker.clear;

