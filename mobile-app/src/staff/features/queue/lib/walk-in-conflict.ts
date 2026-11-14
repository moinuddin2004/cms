/**
 * The backend's `ACTIVE_WITH_OTHER_DOCTOR` payload is
 * `error.entries: [{ entryId, token, doctorName, status }]`
 * (`QueueErrors.activeElsewhere`). The dialog names the first doctor when present.
 */
export function activeElsewhereDoctor(err: unknown): string | null {
  const entries = (err as { response?: { data?: { error?: { entries?: unknown } } } } | null)
    ?.response?.data?.error?.entries;
  if (!Array.isArray(entries)) return null;
  for (const e of entries) {
    const name = (e as { doctorName?: unknown } | null)?.doctorName;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return null;
}
