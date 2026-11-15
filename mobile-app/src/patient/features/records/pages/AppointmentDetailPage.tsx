import { MapPin, Phone } from 'lucide-react-native';
import { Linking, View } from 'react-native';
import { toast } from 'sonner-native';

import {
  ErrorState,
  LoadingSkeleton,
  Screen,
  ScreenHeader,
  StatusBadge,
  EmptyState,
} from '@/core/components';
import { useT } from '@/core/i18n';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

import { ClinicChip } from '../components/ClinicChip';
import { useAppointmentStatusLabel } from '../components/RecordCards';
import { useRecordAppointment } from '../hooks/useRecords';
import { appointmentTone, formatRecordTime } from '../lib/records-format';

async function open(url: string, failed: string) {
  try {
    await Linking.openURL(url);
  } catch {
    toast(failed); // never include the number or address in the toast
  }
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <View className="gap-0.5">
    <Text variant="muted">{label}</Text>
    <Text variant="large">{value}</Text>
  </View>
);

/** Appointment detail (P-03): time on the clinic's clock, clinic, doctor, status, call / directions. */
export function AppointmentDetailPage({ id }: { id: string }) {
  const { t } = useT();
  const statusLabel = useAppointmentStatusLabel();
  const { appointment, isLoading, isError, refetch } = useRecordAppointment(id);
  const header = (
    <ScreenHeader title={t('records.appointment.title')} back backLabel={t('common.back')} />
  );

  if (isLoading) return <Screen header={header}><LoadingSkeleton rows={4} /></Screen>;
  if (isError && !appointment) {
    return (
      <Screen header={header}>
        <ErrorState
          title={t('records.error')}
          message={t('records.errorBody')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }
  if (!appointment) {
    return (
      <Screen header={header}>
        <EmptyState title={t('records.appointment.notFound')} />
      </Screen>
    );
  }

  const { location } = appointment;
  const failed = t('records.openFailed');
  return (
    <Screen scroll header={header} contentClassName="gap-5 pt-2">
      <ClinicChip clinic={appointment.clinic} place={location.name} />
      <Row label={t('records.appointment.when')} value={formatRecordTime(appointment.startTime, location)} />
      {appointment.doctorName ? (
        <Row label={t('records.appointment.doctor')} value={appointment.doctorName} />
      ) : null}
      <View className="gap-1">
        <Text variant="muted">{t('records.appointment.status')}</Text>
        <StatusBadge
          tone={appointmentTone(appointment.status)}
          label={statusLabel(appointment.status)}
        />
      </View>
      {appointment.type ? <Row label={t('records.appointment.type')} value={appointment.type} /> : null}

      {location.phone ? (
        <Button size="lg" onPress={() => void open(`tel:${location.phone}`, failed)}>
          <Icon as={Phone} className="text-primary-foreground size-5" />
          <Text>{t('records.appointment.callClinic')}</Text>
        </Button>
      ) : null}
      {location.address ? (
        <Button
          size="lg"
          variant="outline"
          onPress={() =>
            void open(
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address ?? '')}`,
              failed,
            )
          }>
          <Icon as={MapPin} className="size-5" />
          <Text>{t('records.appointment.directions')}</Text>
        </Button>
      ) : null}
    </Screen>
  );
}
