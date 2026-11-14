import { View } from 'react-native';

import { Text } from '@/core/ui/text';
import { formatDate } from '@/staff/lib/datetime';

import type { GatedQuery } from '../../hooks/gated-query';
import { chartConditions } from '../../lib/patient-detail';
import type { PatientTeethChart } from '../../types/patients.types';
import { DetailBlock, Field, QueryBlock } from './DetailBlock';

/** Latest teeth chart as a read-only list of findings (no drawing on mobile). */
export function ChartSegment({ chart }: { chart: GatedQuery<PatientTeethChart | null> }) {
  if (chart.access !== 'allowed') return null;
  const { query } = chart;
  const latest = query.data ?? null;
  const findings = latest ? chartConditions(latest.chartData) : [];
  return (
    <DetailBlock title="Teeth chart">
      <QueryBlock
        isPending={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        empty={!latest}
        emptyText="No chart recorded.">
        {latest ? (
          <View className="gap-3">
            <Text variant="muted">Recorded {formatDate(latest.recordedAt)}</Text>
            {findings.length === 0 ? <Text variant="muted">No findings on this chart.</Text> : null}
            {findings.map((f) => (
              <Field key={f.tooth} label={`Tooth ${f.tooth}`} value={f.text} />
            ))}
            {latest.notes ? <Field label="Notes" value={latest.notes} /> : null}
          </View>
        ) : null}
      </QueryBlock>
    </DetailBlock>
  );
}
