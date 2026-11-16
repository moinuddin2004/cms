import { memo } from 'react';
import { TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { IconButton, Spinner } from '@/core/components';
import { useCanMutate } from '@/core/http';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';
import { formatTime } from '@/staff/lib/datetime';

import { typeLabel } from '../lib/schedule-view';
import type { AppointmentListItem } from '../types/appointments.types';
import { doctorLabel } from './ScheduleRow';

export interface ArrivalRowProps {
  row: AppointmentListItem;
  /** This row's check-in is running. */
  checkingIn: boolean;
  /** Any check-in is running: the other rows wait. */
  locked: boolean;
  onCheckIn: (row: AppointmentListItem) => void;
  /** Opens the urgent-reason sheet. */
  onCheckInUrgent: (row: AppointmentListItem) => void;
}

/** S-03 row: clinic-clock time, patient, doctor · type, [Check in] and an urgent variant. */
export const ArrivalRow = memo(function ArrivalRow({ row, checkingIn, locked, onCheckIn, onCheckInUrgent }: ArrivalRowProps) {
  const canMutate = useCanMutate();
  const time = formatTime(row.startTime);
  const sub = `${doctorLabel(row)} · ${typeLabel(row.type)}`;

  return (
    <View className="min-h-14 flex-row items-center gap-3 px-4 py-3">
      <Text className="w-16 text-sm font-medium tabular-nums">{time}</Text>
      <View
        accessible
        accessibilityLabel={`${time}, ${row.patient.fullName}, ${sub}`}
        className="flex-1 gap-0.5">
        <Text variant="large" numberOfLines={2}>
          {row.patient.fullName}
        </Text>
        <Text variant="muted" numberOfLines={2}>
          {sub}
        </Text>
      </View>
      <IconButton
        icon={TriangleAlert}
        accessibilityLabel={`Check in ${row.patient.fullName} as urgent`}
        disabled={locked}
        onPress={() => onCheckInUrgent(row)}
      />
      <Button
        className="min-h-11"
        disabled={locked || !canMutate}
        accessibilityLabel={`Check in ${row.patient.fullName}`}
        accessibilityState={{ busy: checkingIn, disabled: locked || !canMutate }}
        onPress={() => onCheckIn(row)}>
        {checkingIn ? <Spinner tone="primary-foreground" /> : null}
        <Text>{canMutate ? 'Check in' : 'Offline'}</Text>
      </Button>
    </View>
  );
});
