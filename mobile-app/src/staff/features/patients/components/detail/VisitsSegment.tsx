import { View } from 'react-native';

import { QUEUE_STATUS_TONES, StatusBadge } from '@/core/components';
import { Text } from '@/core/ui/text';
import { usePatientQueueVisits } from '@/staff/features/queue';
import { formatDate, formatYmd } from '@/staff/lib/datetime';

import { usePatientHistory } from '../../hooks/usePatientHistory';
import { DetailBlock, QueryBlock } from './DetailBlock';

function QueueVisits({ patientId }: { patientId: string }) {
  const q = usePatientQueueVisits(patientId);
  const rows = q.data ?? [];
  return (
    <DetailBlock title="Clinic visits">
      <QueryBlock
        isPending={q.isPending}
        isError={q.isError}
        onRetry={() => void q.refetch()}
        empty={rows.length === 0}
        emptyText="No visits yet.">
        <View className="gap-3">
          {rows.map((v) => (
            <View
              key={v.id}
              accessible
              accessibilityLabel={`${formatYmd(v.serviceDate)}, ${v.token}, ${QUEUE_STATUS_TONES[v.status].label}${v.doctorName ? `, ${v.doctorName}` : ''}`}
              className="min-h-11 gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text>
                  {formatYmd(v.serviceDate)} · {v.token}
                </Text>
                <StatusBadge {...QUEUE_STATUS_TONES[v.status]} />
              </View>
              {v.doctorName ? <Text variant="muted">{v.doctorName}</Text> : null}
              {v.reasonForVisit ? <Text variant="muted">{v.reasonForVisit}</Text> : null}
            </View>
          ))}
        </View>
      </QueryBlock>
    </DetailBlock>
  );
}

function ClinicalHistory({ patientId }: { patientId: string }) {
  const history = usePatientHistory(patientId);
  if (history.access !== 'allowed') return null; // denied/loading: hidden, never an error
  const { query } = history;
  const encounters = query.data?.encounters ?? [];
  return (
    <DetailBlock title="Clinical history">
      <QueryBlock
        isPending={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        empty={encounters.length === 0}
        emptyText="No encounters recorded.">
        <View className="gap-3">
          {encounters.map((e) => (
            <View key={e.id} className="min-h-11 gap-0.5">
              <Text>{formatDate(e.encounterDate)}</Text>
              {e.chiefComplaint ? <Text variant="muted">Complaint: {e.chiefComplaint}</Text> : null}
              {e.diagnosis ? <Text variant="muted">Diagnosis: {e.diagnosis}</Text> : null}
            </View>
          ))}
        </View>
      </QueryBlock>
    </DetailBlock>
  );
}

export function VisitsSegment({ patientId }: { patientId: string }) {
  return (
    <View className="gap-4">
      <QueueVisits patientId={patientId} />
      <ClinicalHistory patientId={patientId} />
    </View>
  );
}
