import { CheckCircle2 } from 'lucide-react-native';
import { View } from 'react-native';

import { useT } from '@/core/i18n';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

import { useConfirmAppointment } from '../hooks/useConfirmAppointment';
import type { PatientAppointment } from '../types/records.types';

/**
 * "Confirm" action for an upcoming appointment, or the calm "you confirmed"
 * note once done. Renders nothing when there is nothing to say.
 */
export function ConfirmAppointment({ appointment }: { appointment: PatientAppointment }) {
  const { t } = useT();
  const confirm = useConfirmAppointment();

  if (appointment.patientConfirmedAt) {
    return (
      <View
        accessible
        accessibilityLabel={t('records.appointment.confirmed')}
        className="flex-row items-center gap-1.5">
        <Icon as={CheckCircle2} className="text-primary size-4" />
        <Text className="text-sm font-medium">{t('records.appointment.confirmed')}</Text>
      </View>
    );
  }
  if (!appointment.canConfirm) return null;

  return (
    <Button
      size="lg"
      className="min-h-11"
      disabled={confirm.isPending}
      accessibilityState={{ busy: confirm.isPending, disabled: confirm.isPending }}
      onPress={() => confirm.mutate(appointment.id)}>
      <Text>{confirm.isPending ? t('records.appointment.confirming') : t('records.appointment.confirm')}</Text>
    </Button>
  );
}
