/**
 * Who is who in the family. The profiles endpoint arrives with M2-10; until it is merged this answers
 * "unknown" and reminders / Today rows simply carry no name. Wire `nameOf` to the profiles query then —
 * nothing else in the medications feature needs to change.
 */
export interface ReminderProfiles {
  nameOf: (profileId: string) => string | null;
}

const UNKNOWN: ReminderProfiles = { nameOf: () => null };

export function useReminderProfiles(): ReminderProfiles {
  return UNKNOWN;
}
