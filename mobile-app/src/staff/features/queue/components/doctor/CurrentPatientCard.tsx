import { View } from 'react-native';

import {
  QUEUE_STATUS_TONES,
  Spinner,
  StatusBadge,
  TokenBadge,
  URGENT_BADGE,
} from '@/core/components';
import { useCanMutate } from '@/core/http';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';

import { useEntryActions } from '../../hooks/useEntryActions';
import type { EntryActionId } from '../../lib/entry-actions';
import type { EntryView, SessionView } from '../../types/queue.types';

export interface CurrentPatientCardProps {
  entry: EntryView;
  session: SessionView;
  /** Any mutation on this entry is running: every button is locked. */
  busy: boolean;
  onAction: (action: EntryActionId, entry: EntryView) => void;
}

const LABELS: Partial<Record<EntryActionId, string>> = {
  start: 'Start',
  complete: 'Done',
  recall: 'Recall',
  'undo-call': 'Undo call',
  skip: 'Skip',
  'send-for-test': 'Send for test',
  abort: 'Abort',
  'patient-file': 'Patient file',
};

const PRIMARY: readonly EntryActionId[] = ['start', 'complete'];

/** S-02a "NOW" card: the called / in-consultation patient with the actions their status allows. */
export function CurrentPatientCard({ entry, session, busy, onAction }: CurrentPatientCardProps) {
  const actions = useEntryActions(entry, session, 'doctor');
  const canMutate = useCanMutate();
  const tone = QUEUE_STATUS_TONES[entry.status];
  const name = entry.patient?.fullName ?? 'Walk-in patient';
  const locked = busy || !canMutate;

  const primary = actions.find((a) => PRIMARY.includes(a));
  const secondary = actions.filter((a) => a !== primary && a !== 'patient-file' && LABELS[a]);
  const hasFile = actions.includes('patient-file');

  return (
    <View
      accessibilityLabel={`Current patient: ${name}, token ${entry.token}, ${tone.label}`}
      className="border-border bg-card mx-4 gap-3 rounded-xl border p-4">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text variant="muted" className="font-semibold">
          NOW
        </Text>
        <TokenBadge token={entry.token} size="md" />
        <StatusBadge {...tone} />
        {entry.priorityClass === 'authorized_urgent' ? <StatusBadge {...URGENT_BADGE} /> : null}
      </View>
      <View className="gap-0.5">
        <Text variant="large">{name}</Text>
        {entry.patient?.patientNumber ? (
          <Text variant="muted">{entry.patient.patientNumber}</Text>
        ) : null}
        {entry.reasonForVisit ? <Text variant="muted">Reason: {entry.reasonForVisit}</Text> : null}
      </View>
      {hasFile ? (
        <Button
          variant="outline"
          className="min-h-11 self-start"
          disabled={busy}
          onPress={() => onAction('patient-file', entry)}>
          <Text>{LABELS['patient-file']}</Text>
        </Button>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {primary ? (
          <Button
            className="min-h-11 flex-1"
            disabled={locked}
            accessibilityState={{ disabled: locked, busy }}
            onPress={() => onAction(primary, entry)}>
            {busy ? <Spinner tone="primary-foreground" /> : null}
            <Text>{LABELS[primary]}</Text>
          </Button>
        ) : null}
        {secondary.map((action) => (
          <Button
            key={action}
            variant={action === 'abort' ? 'destructive' : 'outline'}
            className="min-h-11"
            disabled={locked}
            accessibilityState={{ disabled: locked }}
            onPress={() => onAction(action, entry)}>
            <Text>{LABELS[action]}</Text>
          </Button>
        ))}
      </View>
    </View>
  );
}
