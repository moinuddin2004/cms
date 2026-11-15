import { StatusBadge } from '@/core/components';
import { useT, type MessageKey } from '@/core/i18n';
import { Text } from '@/core/ui/text';

import {
  INVOICE_TONES,
  appointmentTone,
  formatIssuedDate,
  formatMinor,
  formatRecordDate,
  formatRecordTime,
} from '../lib/records-format';
import type {
  BillRow,
  PatientAppointment,
  PatientPrescription,
  PatientVisit,
} from '../types/records.types';
import { ClinicChip } from './ClinicChip';
import { RecordCard } from './RecordCard';

const APPOINTMENT_STATUSES = new Set([
  'scheduled',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
]);

/** Translated appointment status; an unknown future status falls back to its raw text. */
export function useAppointmentStatusLabel() {
  const { t } = useT();
  return (status: string) =>
    APPOINTMENT_STATUSES.has(status) ? t(`records.status.${status}` as MessageKey) : status;
}

export function AppointmentCard({
  item,
  onPress,
}: {
  item: PatientAppointment;
  onPress: () => void;
}) {
  const { t } = useT();
  const statusLabel = useAppointmentStatusLabel();
  const when = formatRecordTime(item.startTime, item.location);
  const label = statusLabel(item.status);
  return (
    <RecordCard
      onPress={onPress}
      accessibilityLabel={[when, item.clinic.name, item.doctorName, label].filter(Boolean).join(', ')}>
      <Text variant="large">{when}</Text>
      {item.doctorName ? (
        <Text variant="muted">{t('records.with', { name: item.doctorName })}</Text>
      ) : null}
      <ClinicChip clinic={item.clinic} place={item.location.name} />
      <StatusBadge tone={appointmentTone(item.status)} label={label} />
    </RecordCard>
  );
}

export function VisitCard({ item }: { item: PatientVisit }) {
  const { t } = useT();
  const date = formatRecordDate(item.date);
  return (
    <RecordCard
      accessibilityLabel={[date, item.clinic.name, item.doctorName, item.diagnosis]
        .filter(Boolean)
        .join(', ')}>
      <Text variant="large">{date}</Text>
      {item.doctorName ? (
        <Text variant="muted">{t('records.with', { name: item.doctorName })}</Text>
      ) : null}
      <ClinicChip clinic={item.clinic} place={item.location.name} />
      {item.diagnosis ? (
        <Text>
          <Text className="font-semibold">{t('records.visit.diagnosis')}: </Text>
          {item.diagnosis}
        </Text>
      ) : null}
      {item.treatments && item.treatments.length > 0 ? (
        <Text>
          <Text className="font-semibold">{t('records.visit.treatments')}: </Text>
          {item.treatments.join(', ')}
        </Text>
      ) : null}
      {item.followUpDate ? (
        <Text variant="muted">
          {t('records.visit.followUp', { date: formatRecordDate(item.followUpDate) })}
        </Text>
      ) : null}
    </RecordCard>
  );
}

export function PrescriptionCard({
  item,
  onPress,
}: {
  item: PatientPrescription;
  onPress: () => void;
}) {
  const { t } = useT();
  const date = formatIssuedDate(item.issuedAt, item.location);
  const count =
    item.medicinesCount === 1
      ? t('records.prescription.medicine')
      : t('records.prescription.medicines', { count: item.medicinesCount });
  return (
    <RecordCard
      onPress={onPress}
      accessibilityLabel={[date, item.clinic.name, item.doctorName, count].filter(Boolean).join(', ')}>
      <Text variant="large">{date}</Text>
      <Text variant="muted">
        {[item.doctorName ? t('records.with', { name: item.doctorName }) : null, count]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <ClinicChip clinic={item.clinic} place={item.location.name} />
    </RecordCard>
  );
}

/** Invoices carry no location, so the date is the UTC calendar day of the issue instant. */
const billDate = (issuedAt: string) => formatRecordDate(issuedAt.slice(0, 10));

export function BillCard({ row }: { row: BillRow }) {
  const { t } = useT();
  const { invoice, clinic, currency } = row;
  const title = t('records.bill.number', { number: invoice.number });
  const date = billDate(invoice.issuedAt);
  const total = formatMinor(invoice.totalMinor, currency);
  return (
    <RecordCard accessibilityLabel={[title, date, clinic.name, total].join(', ')}>
      <Text variant="large">{title}</Text>
      <Text variant="muted">{date}</Text>
      <ClinicChip clinic={clinic} />
      <Text>
        {t('records.bill.total')}: {total} · {t('records.bill.paid')}:{' '}
        {formatMinor(invoice.paidMinor, currency)}
      </Text>
      {invoice.balanceMinor > 0 ? (
        <Text className="font-semibold">
          {t('records.bill.balance')}: {formatMinor(invoice.balanceMinor, currency)}
        </Text>
      ) : null}
      <StatusBadge
        tone={INVOICE_TONES[invoice.status] ?? 'neutral'}
        label={t(`records.invoice.${invoice.status}` as MessageKey)}
      />
    </RecordCard>
  );
}
