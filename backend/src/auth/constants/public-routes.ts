interface PublicRoute {
  method: string;
  path: string;
}

export const PUBLIC_ROUTES: PublicRoute[] = [
  { method: 'POST', path: '/auth/login' },
  { method: 'POST', path: '/auth/register' },
  { method: 'POST', path: '/auth/refresh' },
  { method: 'POST', path: '/auth/forgot-password' },
  { method: 'PATCH', path: '/auth/reset-password' },
  { method: 'POST', path: '/auth/logout' },
  // Waiting-room TV: tokens and doctor names only, never patient data.
  { method: 'GET', path: '/queue/displays/**/state' },
];
