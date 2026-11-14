import { View } from 'react-native';

import { QUEUE_STATUS_TONES, StatusBadge } from '@/core/components';
import { Text } from '@/core/ui/text';
import { usePatientQueueVisits } from '@/staff/features/queue';
import { formatDateTime, todayYmd } from '@/staff/lib/datetime';

import { usePatientVitals } from '../../hooks/usePatientVitals';
import { vitalsParts } from '../../lib/patient-detail';
import type { PatientDetail } from '../../types/patients.types';
import { DetailBlock, Field, QueryBlock } from './DetailBlock';

const FINISHED = new Set(['completed', 'cancelled', 'aborted', 'transferred']);

function TodayQueue({ patientId }: { patientId: string }) {
  const visits = usePatientQueueVisits(patientId);
  const today = todayYmd();
  // Failure or no visit today: nothing to show here (the Visits segment shows load errors).
  const entry = visits.data?.find((v) => v.serviceDate === today && !FINISHED.has(v.status));
  if (!entry) return null;
  return (
    <DetailBlock title="Today's queue">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text variant="large">{entry.token}</Text>
        <StatusBadge {...QUEUE_STATUS_TONES[entry.status]} />
        {entry.doctorName ? <Text variant="muted">{entry.doctorName}</Text> : null}
      </View>
    </DetailBlock>
  );
}

function LatestVitals({ patientId }: { patientId: string }) {
  const vitals = usePatientVitals(patientId);
  if (vitals.access !== 'allowed') return null; // loading or denied: never an error
  const { query } = vitals;
  const latest = query.data?.[0];
  return (
    <DetailBlock title="Latest vitals">
      <QueryBlock
        isPending={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        empty={!latest}
        emptyText="No vitals recorded.">
        {latest ? (
          <View className="gap-2">
            <Text variant="muted">{formatDateTime(latest.recordedAt)}</Text>
            {vitalsParts(latest).map((p) => (
              <Field key={p.label} label={p.label} value={p.value} />
            ))}
          </View>
        ) : null}
      </QueryBlock>
    </DetailBlock>
  );
}

export function OverviewSegment({ patient }: { patient: PatientDetail }) {
  const guardian = [
    patient.guardianName,
    patient.guardianRelation && `(${patient.guardianRelation})`,
    patient.guardianPhone,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <View className="gap-4">
      <DetailBlock title="Contact">
        <Field label="Phone" value={patient.phone} />
        {guardian ? <Field label="Guardian" value={guardian} /> : null}
      </DetailBlock>
      <TodayQueue patientId={patient.id} />
      <DetailBlock title="Medical history">
        <Text variant={patient.medicalHistory?.trim() ? 'default' : 'muted'}>
          {patient.medicalHistory?.trim() || 'No medical history recorded.'}
        </Text>
      </DetailBlock>
      <LatestVitals patientId={patient.id} />
    </View>
  );
}
