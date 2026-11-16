import { View } from 'react-native';

import { EmptyState, ErrorState, LoadingSkeleton, Screen, ScreenHeader } from '@/core/components';
import { useT, type MessageKey } from '@/core/i18n';
import { Text } from '@/core/ui/text';

import { ClinicChip } from '../components/ClinicChip';
import { useRecordPrescription } from '../hooks/useRecords';
import { formatIssuedDate, timingKey } from '../lib/records-format';
import type { PrescriptionMedicine } from '../types/records.types';

const MEALS = new Set(['BEFORE_MEAL', 'AFTER_MEAL', 'WITH_MEAL', 'EMPTY_STOMACH', 'NONE']);

function MedicineCard({ m }: { m: PrescriptionMedicine }) {
  const { t } = useT();
  const meal = MEALS.has(m.mealRelation)
    ? t(`records.prescription.meal.${m.mealRelation}` as MessageKey)
    : null;
  const lines: [string, string | null][] = [
    [t('records.prescription.dose'), m.dosage],
    [t('records.prescription.howOften'), m.frequency],
    [t('records.prescription.when'), [...m.frequencyTiming.map((tag) => (timingKey(tag) ? t(timingKey(tag)!) : tag)), meal].filter(Boolean).join(' · ') || null],
    [t('records.prescription.howLong'), m.duration],
  ];
  return (
    <View className="border-border bg-card gap-2 rounded-xl border p-4">
      <Text variant="large">{m.name}</Text>
      {m.nameUrdu ? <Text className="text-start">{m.nameUrdu}</Text> : null}
      {lines
        .filter(([, v]) => !!v)
        .map(([label, value]) => (
          <Text key={label}>
            <Text className="text-muted-foreground">{label}: </Text>
            {value}
          </Text>
        ))}
      {m.instructions ? (
        <Text>
          <Text className="text-muted-foreground">{t('records.prescription.instructions')}: </Text>
          {m.instructions}
        </Text>
      ) : null}
      {m.instructionsUrdu ? <Text className="text-start">{m.instructionsUrdu}</Text> : null}
    </View>
  );
}

/**
 * Prescription detail (P-03). The PDF share button is not here yet: it needs
 * `expo-file-system` + `expo-sharing` (see HANDOFF) — the PDF streams through
 * the authenticated API, never a URL.
 */
export function PrescriptionDetailPage({ id }: { id: string }) {
  const { t } = useT();
  const { data, isPending, isError, refetch } = useRecordPrescription(id);
  const header = <ScreenHeader title={t('records.prescription.title')} back backLabel={t('common.back')} />;

  if (isPending) return <Screen header={header}><LoadingSkeleton rows={4} /></Screen>;
  if (isError || !data) {
    return (
      <Screen header={header}>
        {isError ? (
          <ErrorState
            title={t('records.error')}
            message={t('records.errorBody')}
            retryLabel={t('common.retry')}
            onRetry={() => void refetch()}
          />
        ) : (
          <EmptyState title={t('records.prescription.notFound')} />
        )}
      </Screen>
    );
  }

  return (
    <Screen scroll header={header} contentClassName="gap-4 pt-2">
      <ClinicChip clinic={data.clinic} place={data.location.name} />
      <Text variant="large">{formatIssuedDate(data.issuedAt, data.location)}</Text>
      {data.doctorName ? (
        <Text variant="muted">{t('records.with', { name: data.doctorName })}</Text>
      ) : null}
      {data.medicines.map((m, i) => (
        <MedicineCard key={`${m.name}-${i}`} m={m} />
      ))}
    </Screen>
  );
}
