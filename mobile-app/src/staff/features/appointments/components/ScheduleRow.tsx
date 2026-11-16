import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { APPOINTMENT_STATUS_TONES, StatusBadge, TokenBadge } from '@/core/components';
import { Text } from '@/core/ui/text';
import { formatTime } from '@/staff/lib/datetime';

import { typeLabel } from '../lib/schedule-view';
import type { AppointmentListItem } from '../types/appointments.types';

export const doctorLabel = (row: Pick<AppointmentListItem, 'doctor'>) =>
  row.doctor.fullName || 'No doctor';

/** One appointment: clinic-clock time, patient, doctor · type, status badge, queue token. */
export const ScheduleRow = memo(function ScheduleRow({ row, onPress }: { row: AppointmentListItem; onPress: (row: AppointmentListItem) => void }) {
  const status = APPOINTMENT_STATUS_TONES[row.status];
  const time = formatTime(row.startTime);
  const sub = `${doctorLabel(row)} · ${typeLabel(row.type)}`;
  const token = row.queueEntry?.token;
  const label = [time, row.patient.fullName, sub, status.label, token && `token ${token}`]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onPress(row)}
      className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-accent">
      <Text className="w-20 text-sm font-medium tabular-nums">{time}</Text>
      <View className="flex-1 gap-0.5">
        <Text variant="large" numberOfLines={2}>
          {row.patient.fullName}
        </Text>
        <Text variant="muted" numberOfLines={2}>
          {sub}
        </Text>
      </View>
      <View className="items-end gap-1">
        <StatusBadge {...status} className="self-end" />
        {token ? <TokenBadge token={token} size="sm" accessibilityLabel={`Token ${token}`} /> : null}
      </View>
    </Pressable>
  );
});
