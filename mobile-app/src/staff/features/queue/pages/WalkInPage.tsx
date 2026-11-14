import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import {
  ConfirmDialog,
  ErrorState,
  FieldWrapper,
  FilterChips,
  FormInput,
  IconButton,
  LoadingSkeleton,
  OfflineAwareButton,
  Screen,
  ScreenHeader,
  SegmentedControl,
  fieldError,
} from '@/core/components';
import { Button } from '@/core/ui/button';
import { Switch } from '@/core/ui/switch';
import { Text } from '@/core/ui/text';

import { WalkInPatientSearch } from '../components/board/WalkInPatientSearch';
import { useBoardUiStore } from '../components/board/useBoardUiStore';
import { useBoard } from '../hooks/useBoard';
import { useWalkInForm } from '../hooks/useWalkInForm';
import type { WalkInValues } from '../schemas/walk-in.schema';
import type { ArrivalResult } from '../types/queue.types';

const MODES = [
  { value: 'existing', label: 'Existing patient' },
  { value: 'new', label: 'New patient' },
];

/** The doctor to preselect: the lane the board was showing, if it is a real doctor on the board. */
function WalkInFormBody({ doctors, initialDoctorId }: {
  doctors: { id: string; fullName: string }[];
  initialDoctorId: string;
}) {
  const router = useRouter();
  const [discardOpen, setDiscardOpen] = useState(false);
  const { focusEntry, showTicket } = useBoardUiStore();

  const onCreated = (result: ArrivalResult, values: WalkInValues) => {
    const name = result.entry.patient?.fullName || values.patientLabel || values.fullName;
    focusEntry(result.entry.id, result.doctorId);
    toast.success(`Token ${result.token} for ${name}`, {
      action: { label: 'Show ticket', onClick: () => showTicket(result.entry.id) },
    });
    router.back();
  };

  const { form, isDirty, forceOpen, dismissForce, confirmForce } = useWalkInForm(
    initialDoctorId,
    onCreated,
  );

  const requestClose = () => (isDirty ? setDiscardOpen(true) : router.back());

  return (
    <>
      <ScreenHeader
        title="Walk-in"
        back={false}
        actions={<IconButton icon={X} accessibilityLabel="Close" onPress={requestClose} />}
      />
      <form.Field name="doctorId">
        {(field) => (
          <FieldWrapper label="Doctor" required error={fieldError(field)}>
            <View className="-mx-4">
              <FilterChips
                options={doctors.map((d) => ({ value: d.id, label: d.fullName }))}
                value={field.state.value ? [field.state.value] : []}
                onChange={(v) => field.handleChange(v[0] ?? '')}
              />
            </View>
          </FieldWrapper>
        )}
      </form.Field>

      <form.Field name="mode">
        {(field) => (
          <SegmentedControl
            segments={MODES}
            value={field.state.value}
            onChange={(v) => field.handleChange(v === 'new' ? 'new' : 'existing')}
          />
        )}
      </form.Field>

      <form.Subscribe selector={(s) => s.values.mode}>
        {(mode) =>
          mode === 'existing' ? (
            <form.Field name="patientId">
              {(field) => (
                <FieldWrapper label="Patient" required error={fieldError(field)}>
                  <form.Field name="patientLabel">
                    {(labelField) =>
                      field.state.value ? (
                        <View className="flex-row items-center justify-between gap-2">
                          <Text variant="large" className="flex-1">
                            {labelField.state.value}
                          </Text>
                          <Button
                            variant="outline"
                            className="min-h-11"
                            onPress={() => {
                              field.handleChange('');
                              labelField.handleChange('');
                            }}>
                            <Text>Change</Text>
                          </Button>
                        </View>
                      ) : (
                        <WalkInPatientSearch
                          onPick={(p) => {
                            field.handleChange(p.id);
                            labelField.handleChange(p.label);
                          }}
                        />
                      )
                    }
                  </form.Field>
                </FieldWrapper>
              )}
            </form.Field>
          ) : (
            <>
              <form.Field name="fullName">
                {(field) => (
                  <FieldWrapper label="Full name" required error={fieldError(field)}>
                    <FormInput
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      onBlur={field.handleBlur}
                      invalid={!!fieldError(field)}
                      autoComplete="name"
                      textContentType="name"
                      returnKeyType="next"
                    />
                  </FieldWrapper>
                )}
              </form.Field>
              <form.Field name="phone">
                {(field) => (
                  <FieldWrapper label="Phone" required error={fieldError(field)}>
                    <FormInput
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      onBlur={field.handleBlur}
                      invalid={!!fieldError(field)}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      returnKeyType="next"
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            </>
          )
        }
      </form.Subscribe>

      <form.Field name="reasonForVisit">
        {(field) => (
          <FieldWrapper label="Reason for visit" error={fieldError(field)}>
            <FormInput
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              invalid={!!fieldError(field)}
              placeholder="Optional"
              returnKeyType="done"
            />
          </FieldWrapper>
        )}
      </form.Field>

      <form.Field name="urgent">
        {(field) => (
          <View className="min-h-11 flex-row items-center justify-between gap-3">
            <Text className="text-base">Urgent</Text>
            <Switch
              checked={field.state.value}
              onCheckedChange={field.handleChange}
              accessibilityLabel="Urgent"
            />
          </View>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => s.values.urgent}>
        {(urgent) =>
          urgent ? (
            <form.Field name="urgentReason">
              {(field) => (
                <FieldWrapper label="Urgent reason" required error={fieldError(field)}>
                  <FormInput
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    invalid={!!fieldError(field)}
                    returnKeyType="done"
                  />
                </FieldWrapper>
              )}
            </form.Field>
          ) : null
        }
      </form.Subscribe>

      <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit, isSubmitting: s.isSubmitting })}>
        {({ canSubmit, isSubmitting }) => (
          <OfflineAwareButton
            label={isSubmitting ? 'Adding…' : 'Add to queue'}
            className="min-h-12"
            disabled={!canSubmit || isSubmitting}
            accessibilityState={{ busy: isSubmitting }}
            onPress={() => void form.handleSubmit()}
          />
        )}
      </form.Subscribe>

      <ConfirmDialog
        open={forceOpen}
        onClose={dismissForce}
        title="Already in another doctor's queue"
        description="This patient is already waiting for a different doctor today. Add anyway?"
        confirmLabel="Add anyway"
        cancelLabel="Cancel"
        onConfirm={confirmForce}
      />
      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard changes?"
        description="The walk-in you entered will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => router.back()}
      />
      <Stack.Screen options={{ gestureEnabled: !isDirty }} />
    </>
  );
}

/** S-02c walk-in (modal route). Doctors come from the board; the lane that was open is preselected. */
export function WalkInPage() {
  const { doctorId } = useLocalSearchParams<{ doctorId?: string }>();
  const board = useBoard();
  const doctors = board.data?.lanes.map((l) => l.doctor) ?? [];
  const initial = doctors.find((d) => d.id === doctorId)?.id ?? '';

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      contentClassName="gap-4">
      <Stack.Screen options={{ presentation: 'modal' }} />
      {board.isPending ? (
        <LoadingSkeleton rows={4} />
      ) : board.isError ? (
        <ErrorState onRetry={() => void board.refetch()} />
      ) : (
        <WalkInFormBody doctors={doctors} initialDoctorId={initial} />
      )}
    </Screen>
  );
}
