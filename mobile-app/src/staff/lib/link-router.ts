/** An app route to hand to `router.push` / `router.navigate`. */
export interface StaffRoute {
  pathname: string;
  params?: Record<string, string>;
}

const PATIENT_ID = /^\/patients\/([A-Za-z0-9-]+)$/;

/**
 * Maps a notification `link` (set by the backend) to an app route, or `null` when the app has no
 * screen for it (the caller then stays where it is). Pure; shared by the notifications screen
 * and push-tap routing (M1-05).
 *
 * - `/queue/doctor` → Queue tab, doctor segment
 * - `/queue`, `/appointments` → Queue tab, board segment
 * - `/patients/:id` → `/patients/<id>`
 */
export function resolveStaffLink(link: string | null | undefined): StaffRoute | null {
  if (!link || typeof link !== 'string') return null;
  const path = link.trim().split(/[?#]/)[0]!.replace(/\/+$/, '') || '/';
  if (path === '/queue/doctor') return { pathname: '/queue', params: { segment: 'doctor' } };
  if (path === '/queue' || path === '/appointments') {
    return { pathname: '/queue', params: { segment: 'board' } };
  }
  const patient = PATIENT_ID.exec(path);
  if (patient) return { pathname: `/patients/${patient[1]}` };
  return null;
}
