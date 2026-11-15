import { useState } from 'react';
import { View } from 'react-native';

import { FormSheet, ListRow, StatusBadge, type StatusTone } from '@/core/components';
import { Text } from '@/core/ui/text';
import { formatDate } from '@/staff/lib/datetime';

import type { GatedQuery } from '../../hooks/gated-query';
import type {
  PrescriptionListItem,
  PrescriptionPage,
  PrescriptionStatus,
} from '../../types/patients.types';
import { DetailBlock, Field, QueryBlock } from './DetailBlock';

const RX_STATUS: Record<PrescriptionStatus, { label: string; tone: StatusTone }> = {
  FINALIZED: { label: 'Finalized', tone: 'success' },
  AMENDED: { label: 'Amended', tone: 'info' },
  DRAFT: { label: 'Draft', tone: 'neutral' },
};

function PrescriptionDetail({ rx }: { rx: PrescriptionListItem }) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <StatusBadge {...RX_STATUS[rx.status]} />
        <Text variant="muted">{formatDate(rx.createdAt)}</Text>
      </View>
      {rx.doctor?.fullName ? <Field label="Doctor" value={rx.doctor.fullName} /> : null}
      {rx.diagnosis ? <Field label="Diagnosis" value={rx.diagnosis} /> : null}
      <DetailBlock title="Medicines">
        {rx.medicines.length === 0 ? <Text variant="muted">No medicines.</Text> : null}
        {rx.medicines.map((m, i) => (
          <View key={m.id ?? i} className="gap-0.5 py-1">
            <Text>{m.medicineName}</Text>
            <Text variant="muted">
              {[m.dosage, m.frequency, m.duration].filter(Boolean).join(' · ')}
            </Text>
            {m.specialInstructions ? <Text variant="muted">{m.specialInstructions}</Text> : null}
          </View>
        ))}
      </DetailBlock>
      {rx.instructionsEnglish ? <Field label="Instructions" value={rx.instructionsEnglish} /> : null}
      {rx.furtherPlan ? <Field label="Further plan" value={rx.furtherPlan} /> : null}
    </View>
  );
}

/** Prescription list (the hook already puts finalized/amended first) + a read-only detail sheet. */
export function RxSegment({ rx }: { rx: GatedQuery<PrescriptionPage> }) {
  const [selected, setSelected] = useState<PrescriptionListItem | null>(null);
  if (rx.access !== 'allowed') return null;
  const { query } = rx;
  const rows = query.data?.data ?? [];
  return (
    <DetailBlock title="Prescriptions">
      <QueryBlock
        isPending={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        empty={rows.length === 0}
        emptyText="No prescriptions yet.">
        <View className="-mx-4">
          {rows.map((p) => (
            <ListRow
              key={p.id}
              title={p.prescriptionNumber}
              subtitle={`${formatDate(p.createdAt)}${p.diagnosis ? ` · ${p.diagnosis}` : ''}`}
              trailing={<StatusBadge {...RX_STATUS[p.status]} />}
              onPress={() => setSelected(p)}
            />
          ))}
        </View>
      </QueryBlock>
      <FormSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.prescriptionNumber ?? 'Prescription'}
        closeLabel="Close"
        discard={{ title: '', description: '', confirmLabel: '', cancelLabel: '' }}>
        {selected ? <PrescriptionDetail rx={selected} /> : null}
      </FormSheet>
    </DetailBlock>
  );
}
