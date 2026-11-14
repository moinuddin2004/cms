import { useStore } from '@tanstack/react-form';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { fieldError, FieldWrapper, FilterChips, FormInput, FormSheet } from '@/core/components';
import { Button } from '@/core/ui/button';
import { Switch } from '@/core/ui/switch';
import { Text } from '@/core/ui/text';

import { useCheckPhone } from '../hooks/useCheckPhone';
import { useQuickRegisterForm } from '../hooks/useQuickRegisterForm';
import type { PatientDetail } from '../types/patients.types';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const DISCARD = {
  title: 'Discard changes?',
  description: 'The patient has not been registered yet.',
  confirmLabel: 'Discard',
  cancelLabel: 'Keep editing',
};

interface QuickRegisterSheetProps {
  open: boolean;
  onClose: () => void;
  /** The patient was created: the page closes the sheet, toasts and opens the record. */
  onCreated: (patient: PatientDetail) => void;
  /** "Search" on the duplicate-phone notice: the page fills its search box with the phone. */
  onSearchPhone: (phone: string) => void;
}

/** S-04b quick register: name, phone, gender, DOB (YYYY-MM-DD text), minor → guardian. */
export function QuickRegisterSheet({
  open,
  onClose,
  onCreated,
  onSearchPhone,
}: QuickRegisterSheetProps) {
  // The phone the user last left the field with; the duplicate check runs for this value only.
  const [blurredPhone, setBlurredPhone] = useState('');
  const { form, isDirty } = useQuickRegisterForm((patient) => {
    setBlurredPhone('');
    onCreated(patient);
  });
  const canSubmit = useStore(form.store, (s) => s.canSubmit);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  const check = useCheckPhone(blurredPhone);

  const close = () => {
    form.reset();
    setBlurredPhone('');
    onClose();
  };

  return (
    <FormSheet
      open={open}
      onClose={close}
      title="Register patient"
      isDirty={isDirty}
      discard={DISCARD}
      closeLabel="Close"
      submit={{
        label: 'Register',
        onPress: () => void form.handleSubmit(),
        disabled: !canSubmit || isSubmitting,
        pending: isSubmitting,
      }}>
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
              autoCapitalize="words"
              returnKeyType="next"
              accessibilityLabel="Full name"
            />
          </FieldWrapper>
        )}
      </form.Field>

      <form.Field name="phone">
        {(field) => {
          const current = field.state.value.trim();
          const exists = check.data?.exists === true && blurredPhone === current;
          return (
            <FieldWrapper label="Phone" required error={fieldError(field)}>
              <FormInput
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={() => {
                  field.handleBlur();
                  setBlurredPhone(field.state.value.trim());
                }}
                invalid={!!fieldError(field)}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="next"
                accessibilityLabel="Phone"
              />
              {exists ? (
                <View
                  accessibilityRole="alert"
                  className="bg-muted flex-row items-center justify-between gap-2 rounded-md ps-3">
                  <Text className="flex-1 text-sm">A patient with this phone already exists</Text>
                  <Button
                    variant="link"
                    className="min-h-11"
                    onPress={() => {
                      form.reset();
                      setBlurredPhone('');
                      onSearchPhone(current);
                    }}>
                    <Text>Search</Text>
                  </Button>
                </View>
              ) : null}
            </FieldWrapper>
          );
        }}
      </form.Field>

      <form.Field name="gender">
        {(field) => (
          <FieldWrapper label="Gender">
            <View className="-mx-4">
              <FilterChips
                options={GENDERS}
                value={field.state.value ? [String(field.state.value)] : []}
                onChange={(v) => field.handleChange(v[0] ?? '')}
              />
            </View>
          </FieldWrapper>
        )}
      </form.Field>

      <form.Field name="dob">
        {(field) => (
          <FieldWrapper label="Date of birth" hint="Format YYYY-MM-DD" error={fieldError(field)}>
            <FormInput
              value={field.state.value ?? ''}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              invalid={!!fieldError(field)}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
              maxLength={10}
              returnKeyType="next"
              accessibilityLabel="Date of birth"
            />
          </FieldWrapper>
        )}
      </form.Field>

      <form.Field name="isMinor">
        {(field) => (
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Patient is a minor"
            accessibilityState={{ checked: field.state.value }}
            onPress={() => field.handleChange(!field.state.value)}
            className="min-h-11 flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-base">Patient is a minor</Text>
            <Switch
              checked={field.state.value}
              onCheckedChange={field.handleChange}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            />
          </Pressable>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => s.values.isMinor}>
        {(isMinor) =>
          isMinor ? (
            <View className="gap-4">
              <form.Field name="guardianName">
                {(field) => (
                  <FieldWrapper label="Guardian name" required error={fieldError(field)}>
                    <FormInput
                      value={field.state.value ?? ''}
                      onChangeText={field.handleChange}
                      onBlur={field.handleBlur}
                      invalid={!!fieldError(field)}
                      autoCapitalize="words"
                      returnKeyType="next"
                      accessibilityLabel="Guardian name"
                    />
                  </FieldWrapper>
                )}
              </form.Field>
              <form.Field name="guardianPhone">
                {(field) => (
                  <FieldWrapper label="Guardian phone" required error={fieldError(field)}>
                    <FormInput
                      value={field.state.value ?? ''}
                      onChangeText={field.handleChange}
                      onBlur={field.handleBlur}
                      invalid={!!fieldError(field)}
                      keyboardType="phone-pad"
                      returnKeyType="next"
                      accessibilityLabel="Guardian phone"
                    />
                  </FieldWrapper>
                )}
              </form.Field>
              <form.Field name="guardianRelation">
                {(field) => (
                  <FieldWrapper label="Relation" error={fieldError(field)}>
                    <FormInput
                      value={field.state.value ?? ''}
                      onChangeText={field.handleChange}
                      onBlur={field.handleBlur}
                      invalid={!!fieldError(field)}
                      returnKeyType="done"
                      accessibilityLabel="Relation"
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            </View>
          ) : null
        }
      </form.Subscribe>
    </FormSheet>
  );
}
