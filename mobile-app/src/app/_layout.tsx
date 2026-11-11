import '@/global.css';

import { RootShell } from '@/shell/RootShell';

/** The root route: composition root + root guards. All logic lives in `@/shell`. */
export default function RootLayout() {
  return <RootShell />;
}
