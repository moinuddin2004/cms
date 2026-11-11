import { Redirect } from 'expo-router';

import { useSpaceStore } from '@/core/space/useSpaceStore';

/**
 * The "/" screen (docs/02 §4). It only routes by `activeSpace`; the space
 * layout's own guards then pick login / select-location / main. Without a
 * chosen space the welcome picker is the destination.
 */
export function EntryRedirect() {
  const activeSpace = useSpaceStore((s) => s.activeSpace);

  if (activeSpace === 'staff') return <Redirect href="/login" />;
  if (activeSpace === 'patient') return <Redirect href="/(patient)" />;
  return <Redirect href="/welcome" />;
}
