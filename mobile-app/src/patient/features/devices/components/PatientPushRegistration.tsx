import { Bell } from 'lucide-react-native';

import { ActionSheet } from '@/core/components';
import { useT } from '@/core/i18n';

import { usePatientPushRegistration } from '../hooks/usePatientPushRegistration';

/** Mounted once in the signed-in patient layout: registers the phone and, once, asks to turn alerts on. */
export function PatientPushRegistration() {
  const { t } = useT();
  const { sheetOpen, enable, dismiss } = usePatientPushRegistration();

  return (
    <ActionSheet
      open={sheetOpen}
      onClose={dismiss}
      title={t('push.sheetTitle')}
      cancelLabel={t('push.notNow')}
      actions={[{ label: t('push.turnOn'), icon: Bell, onPress: () => void enable() }]}
    />
  );
}
