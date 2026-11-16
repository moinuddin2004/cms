import { View } from 'react-native';

import { formatInZone } from '@/core/datetime';
import { Text } from '@/core/ui/text';
import { type PatientAppointment } from '@/patient/features/records';

/** An appointment line: time on the CLINIC's clock, clinic and doctor. */
export function AppointmentRow({ item, withDay }: { item: PatientAppointment; withDay: boolean }) {
  const when = formatInZone(item.startTime, item.location.timezone, withDay ? 'EEE d MMM · h:mm a' : 'h:mm a');
  const who = [item.clinic.name, item.doctorName].filter(Boolean).join(' · ');
  return (
    <View accessible accessibilityLabel={`${when}, ${who}`} className="bg-card border-border flex-row items-center gap-3 rounded-xl border p-3">
      <Text variant="large">{when}</Text>
      <Text variant="muted" className="flex-1">
        {who}
      </Text>
    </View>
  );
}
