import { Redirect } from 'expo-router';

import { useSpaceStore, type Space } from '@/core/space/useSpaceStore';

/**
 * Where the app starts for the active space: the space's first screen, or the welcome picker
 * when no space is chosen. The space layout's own guards then pick login / select-location / main.
 */
export function entryHref(space: Space | null): '/login' | '/sign-in' | '/welcome' {
  if (space === 'staff') return '/login';
  if (space === 'patient') return '/sign-in';
  return '/welcome';
}

/** The "/" screen (docs/02 §4). It only routes by `activeSpace`. */
export function EntryRedirect() {
  const activeSpace = useSpaceStore((s) => s.activeSpace);
  return <Redirect href={entryHref(activeSpace)} />;
}
