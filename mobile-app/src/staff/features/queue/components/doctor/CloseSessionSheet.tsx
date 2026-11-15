import { View } from 'react-native';

import { FilterChips, FormSheet, SegmentedControl } from '@/core/components';
import { Text } from '@/core/ui/text';

import { useCloseSessionForm } from '../../hooks/useCloseSessionForm';
import { useDoctorChoices } from '../../hooks/useDoctorChoices';
import {
  canTransferEntry,
  closeLeftovers,
  effectiveDraft,
  type DecisionDraft,
} from '../../lib/close-decisions';
import type { CloseDecision, EntryView, SessionView } from '../../types/queue.types';

const CHOICES = [
  { value: 'cancel', label: 'Cancel visit' },
  { value: 'transfer', label: 'Transfer' },
];

export interface CloseSessionSheetProps {
  open: boolean;
  onClose: () => void;
  session: SessionView;
  entries: EntryView[];
  /** Resolves on success (the sheet closes); rejects on failure (stays open, choices kept). */
  onConfirm: (decisions: CloseDecision[]) => Promise<unknown>;
}

const tokenLine = (e: EntryView) => (e.patient ? `${e.token} · ${e.patient.fullName}` : e.token);

/**
 * End of day (docs/06 S-02a): every waiting / skipped / on-hold patient needs a
 * decision before the server closes the session. A waiting patient can be
 * cancelled or moved to another doctor; skipped and on-hold ones can only be
 * cancelled (backend rule), so they need no tap.
 */
export function CloseSessionSheet({ open, onClose, session, entries, onConfirm }: CloseSessionSheetProps) {
  const leftovers = closeLeftovers(entries);
  const needsDoctors = leftovers.some((e) => e.status === 'waiting');
  const doctorsQuery = useDoctorChoices(open && needsDoctors);
  const targets = (doctorsQuery.data ?? [])
    .filter((d) => d.id !== session.doctorId)
    .map((d) => ({ value: d.id, label: d.fullName || 'No name' }));
  const hasTargets = targets.length > 0;
  // Transfers wait for the doctor list; until then the choice is not offered.
  const doctorsLoading = needsDoctors && doctorsQuery.isPending;

  const { form, drafts, isDirty, canSubmit, isSubmitting } = useCloseSessionForm(
    leftovers,
    hasTargets,
    async (decisions) => {
      await onConfirm(decisions);
      onClose();
    },
  );

  const moving = leftovers.filter((e) => {
    const d = effectiveDraft(e, drafts[e.id], hasTargets);
    return d.action === 'transfer';
  }).length;
  const summary =
    leftovers.length === 0
      ? 'No one is left in the queue.'
      : `${leftovers.length - moving} will be cancelled, ${moving} transferred.`;

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title="Close session"
      isDirty={isDirty}
      closeLabel="Close"
      discard={{
        title: 'Discard changes?',
        description: 'Your choices for the remaining patients will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
      }}
      error={
        needsDoctors && doctorsQuery.isError
          ? 'Could not load the other doctors. Transfers are unavailable; you can still cancel.'
          : undefined
      }
      submit={{
        label: 'Close session',
        disabled: !canSubmit || doctorsLoading,
        pending: isSubmitting,
        onPress: () => void form.handleSubmit(),
      }}>
      <Text variant="muted">
        {leftovers.length === 0
          ? 'This ends the queue for today.'
          : 'Decide what happens to each remaining patient. This ends the queue for today.'}
      </Text>
      <form.Field name="drafts">
        {(field) => (
          <View className="gap-4">
            {leftovers.map((entry) => {
              const canMove = canTransferEntry(entry, hasTargets);
              const draft = effectiveDraft(entry, field.state.value[entry.id], hasTargets);
              const set = (next: DecisionDraft) =>
                field.handleChange({ ...field.state.value, [entry.id]: next });
              return (
                <View key={entry.id} className="gap-2">
                  <Text variant="large" numberOfLines={2}>
                    {tokenLine(entry)}
                  </Text>
                  {canMove ? (
                    <>
                      <SegmentedControl
                        segments={CHOICES}
                        value={draft.action}
                        onChange={(v) =>
                          set({ action: v === 'transfer' ? 'transfer' : 'cancel', toDoctorId: '' })
                        }
                      />
                      {draft.action === 'transfer' ? (
                        <View className="-mx-4">
                          <FilterChips
                            options={targets}
                            value={draft.toDoctorId ? [draft.toDoctorId] : []}
                            onChange={(v) => set({ action: 'transfer', toDoctorId: v[0] ?? '' })}
                          />
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <Text variant="muted">
                      {entry.status === 'waiting'
                        ? 'Will be cancelled (no other doctor to transfer to).'
                        : 'Will be cancelled (only waiting patients can be transferred).'}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </form.Field>
      <Text variant="muted" accessibilityLiveRegion="polite">
        {summary}
      </Text>
    </FormSheet>
  );
}
