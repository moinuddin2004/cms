import type { ReactNode } from 'react';
import { View } from 'react-native';

import { APPOINTMENT_STATUS_TONES, ReadOnlySheet, StatusBadge, TokenBadge } from '@/core/components';
import { Text } from '@/core/ui/text';
import { formatDate, formatTime } from '@/staff/lib/datetime';

import { useAppointment } from '../hooks/useAppointments';
import { typeLabel } from '../lib/schedule-view';
import type { AppointmentListItem } from '../types/appointments.types';

import { doctorLabel } from './ScheduleRow';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1">
      <Text variant="muted">{label}</Text>
      {children}
    </View>
  );
}

export interface AppointmentSheetProps {
  /** The tapped row (kept after close so the content does not vanish mid-animation). */
  row: AppointmentListItem | null;
  open: boolean;
  onClose: () => void;
  /** Show the [Check in] button (`canCheckIn(...)`). */
  allowCheckIn: boolean;
  onCheckIn: () => void;
  checkingIn: boolean;
  /** Offline: the button reads "Offline" and is disabled. */
  offline: boolean;
}

/**
 * Read-only appointment sheet (docs/06 S-06) with [Check in] when allowed.
 * Shown from the list row; a booking's detail adds the cancel reason. A
 * walk-in row has no appointment record, so it never fetches one.
 */
export function AppointmentSheet({
  row,
  open,
  onClose,
  allowCheckIn,
  onCheckIn,
  checkingIn,
  offline,
}: AppointmentSheetProps) {
  const detailId = row && row.kind !== 'walk_in' && row.status === 'cancelled' ? row.id : undefined;
  const detail = useAppointment(detailId).data;
  const status = row ? APPOINTMENT_STATUS_TONES[row.status] : null;
  const reason = row?.reasonForVisit?.trim();
  const cancelReason = detail?.cancelReason?.trim();

  return (
    <ReadOnlySheet
      open={open && row !== null}
      onClose={onClose}
      title="Appointment"
      closeLabel="Close appointment"
      submit={
        open && row && allowCheckIn
          ? {
              label: offline ? 'Offline' : 'Check in',
              onPress: onCheckIn,
              disabled: offline,
              pending: checkingIn,
            }
          : undefined
      }>
      {row && status ? (
        <>
          <View className="gap-1">
            <Text variant="large">{row.patient.fullName}</Text>
            {row.patient.patientNumber ? (
              <Text variant="muted">{row.patient.patientNumber}</Text>
            ) : null}
          </View>
          <Field label="When">
            <Text>{`${formatDate(row.startTime)}, ${formatTime(row.startTime)} – ${formatTime(row.endTime)}`}</Text>
          </Field>
          <Field label="Doctor">
            <Text>{doctorLabel(row)}</Text>
          </Field>
          <Field label="Type">
            <Text>{typeLabel(row.type)}</Text>
          </Field>
          <Field label="Status">
            <StatusBadge {...status} />
          </Field>
          {row.queueEntry ? (
            <Field label="Queue token">
              <TokenBadge token={row.queueEntry.token} accessibilityLabel={`Token ${row.queueEntry.token}`} />
            </Field>
          ) : null}
          {reason ? (
            <Field label="Reason for visit">
              <Text>{reason}</Text>
            </Field>
          ) : null}
          {cancelReason ? (
            <Field label="Cancel reason">
              <Text>{cancelReason}</Text>
            </Field>
          ) : null}
        </>
      ) : null}
    </ReadOnlySheet>
  );
}
