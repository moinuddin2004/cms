// Full-screen loader shown while the session is restored on app start.
// No product name — the product serves every clinic type. The trace uses
// the clinic's brand colour, injected before first paint from the cache.
const ECG_PATH =
  'M0 30 H70 L78 22 L86 30 H96 L104 6 L114 52 L122 30 H134 L142 24 L150 30 H200'

export function AppLoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-background"
    >
      <svg
        viewBox="0 0 200 60"
        className="h-14 w-48 text-primary"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Faint resting trace under the animated one */}
        <path d={ECG_PATH} className="text-border" stroke="currentColor" />
        <path d={ECG_PATH} pathLength={1} className="animate-ecg-trace" />
      </svg>
      <span className="sr-only">Loading</span>
    </div>
  )
}
