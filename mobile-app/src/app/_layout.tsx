import '@/global.css';

import { RootShell } from '@/shell/RootShell';

export { RootErrorBoundary as ErrorBoundary } from '@/shell/RootErrorBoundary';

/** The root route: composition root + root guards. All logic lives in `@/shell`. */
export default function RootLayout() {
  return <RootShell />;
}
