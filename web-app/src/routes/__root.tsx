import { QueryClientProvider } from '@tanstack/react-query';
import { HeadContent, Outlet, Scripts, createRootRoute, useNavigate, useLocation } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

import { queryClient } from '@/lib/query-client';
import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { title: 'MedTrackr — Dental Clinic Management' },
      {
        name: 'description',
        content: 'Production-grade SaaS dental clinic management system',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { accessToken } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const isPublicRoute = ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname);
    
    if (!accessToken && !isPublicRoute && location.pathname !== '/') {
      navigate({ to: '/login', replace: true });
    } else if (accessToken && isPublicRoute) {
      // If user is logged in but tries to access login page, redirect to their panel or dashboard
      navigate({ to: '/reports', replace: true }); 
    }
  }, [accessToken, location.pathname, navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
