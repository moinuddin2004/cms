import { Bell } from 'lucide-react-native';

import { ActionSheet } from '@/core/components';

import { usePushRegistration } from '../hooks/usePushRegistration';

/** Mounted once in the signed-in staff layout: registers the phone and, once, asks to turn alerts on. */
export function PushRegistration() {
  const { sheetOpen, enable, dismiss } = usePushRegistration();

  return (
    <ActionSheet
      open={sheetOpen}
      onClose={dismiss}
      title="Get alerts when patients arrive"
      cancelLabel="Not now"
      actions={[{ label: 'Turn on alerts', icon: Bell, onPress: () => void enable() }]}
    />
  );
}
