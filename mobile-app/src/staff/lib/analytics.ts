import { createTracker } from '@/core/analytics';
import { staffApi } from '@/staff/lib/api';

/** Staff product events (M2-13): names/props are the allow-list in docs/analytics-events.md. */
export type StaffEventName = 'staff_signed_in' | 'staff_checked_in' | 'staff_called_next';

const tracker = createTracker<StaffEventName>({
  send: async (events) => {
    await staffApi.post('/me/events', { events });
  },
});

export const trackStaff = tracker.track;
export const flushStaffEvents = tracker.flush;
