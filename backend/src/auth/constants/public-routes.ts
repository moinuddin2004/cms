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
  { method: 'POST', path: '/auth/verify-email' },
  { method: 'POST', path: '/auth/logout' },
  // Google sign-in: the verified Google ID token is the credential.
  { method: 'GET', path: '/auth/google/config' },
  { method: 'POST', path: '/auth/google' },
  { method: 'POST', path: '/auth/google/register' },
  { method: 'POST', path: '/auth/google/join-request' },
  // Login-page theme: theme tokens only (settings-registry ThemeController).
  { method: 'GET', path: '/public/theme/**' },
  // Waiting-room TV: tokens and doctor names only, never patient data.
  { method: 'GET', path: '/queue/displays/**/state' },
  // Lab magic links (lab ERD §7): the token in the path is the credential.
  { method: 'GET', path: '/lab-link/**' },
  { method: 'POST', path: '/lab-link/**/accept' },
  { method: 'POST', path: '/lab-link/**/reject' },
  { method: 'POST', path: '/lab-link/**/clarification' },
  { method: 'GET', path: '/lab-link/**/attachments/**/url' },
];
