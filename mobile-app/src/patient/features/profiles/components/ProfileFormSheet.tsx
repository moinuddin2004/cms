import { useStore } from '@tanstack/react-form';
import { useEffect } from 'react';
import { View } from 'react-native';

import { fieldError, FieldWrapper, FilterChips, FormInput, FormSheet } from '@/core/components';
import { useT } from '@/core/i18n';

import { useProfileForm } from '../hooks/useProfileForm';
import { FAMILY_RELATIONS, profileDefaults } from '../lib/profile-input';
import type { Gender, Profile } from '../types/profiles.types';

const GENDERS: Gender[] = ['male', 'female', 'other'];

export interface ProfileFormSheetProps {
  open: boolean;
  onClose: () => void;
  /** Edit this profile; omit to add a family member. */
  profile?: Profile;
}

/** Add / edit a profile in a bottom sheet (P-04). Profile data is the patient's own, never the clinic record. */
export function ProfileFormSheet({ open, onClose, profile }: ProfileFormSheetProps) {
  const { t } = useT();
  const { form, isDirty } = useProfileForm(profile, onClose);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);

  // Every opening starts from the profile's current values (it may have changed since).
  useEffect(() => {
    if (open) form.reset(profileDefaults(profile));
  }, [open, profile, form]);

  const close = () => {
    form.reset(profileDefaults(profile));
    onClose();
  };

  return (
    <FormSheet
      open={open}
      onClose={close}
      title={profile ? t('family.sheet.editTitle') : t('family.sheet.addTitle')}
      isDirty={isDirty}
      discard={{
        title: t('family.sheet.discardTitle'),
        description: t('family.sheet.discardBody'),
        confirmLabel: t('family.sheet.discardConfirm'),
        cancelLabel: t('family.sheet.keepEditing'),
      }}
      closeLabel={t('family.sheet.close')}
      submit={{
        label: profile ? t('family.sheet.save') : t('family.sheet.add'),
        onPress: () => void form.handleSubmit(),
        disabled: !canSubmit || isSubmitting,
        pending: isSubmitting,
      }}>
      <form.Field name="fullName">
        {(field) => (
          <FieldWrapper label={t('family.sheet.name')} required error={fieldError(field)}>
            <FormInput
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              invalid={!!fieldError(field)}
              placeholder={t('family.sheet.namePlaceholder')}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              accessibilityLabel={t('family.sheet.name')}
            />
          </FieldWrapper>
        )}
      </form.Field>

      {profile?.isSelf ? null : (
        <form.Field name="relation">
          {(field) => (
            <FieldWrapper label={t('family.sheet.relation')} required error={fieldError(field)}>
              <View className="-mx-4">
                <FilterChips
                  options={FAMILY_RELATIONS.map((value) => ({ value, label: t(`relation.${value}`) }))}
                  value={[field.state.value]}
                  // A relation is always chosen: tapping the chosen chip keeps it.
                  onChange={(v) => field.handleChange((v[v.length - 1] ?? field.state.value) as typeof field.state.value)}
                />
              </View>
            </FieldWrapper>
          )}
        </form.Field>
      )}

      <form.Field name="dob">
        {(field) => (
          <FieldWrapper label={t('family.sheet.dob')} hint={t('family.sheet.dobHint')} error={fieldError(field)}>
            <FormInput
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              invalid={!!fieldError(field)}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
              maxLength={10}
              returnKeyType="done"
              accessibilityLabel={t('family.sheet.dob')}
            />
          </FieldWrapper>
        )}
      </form.Field>

      <form.Field name="gender">
        {(field) => (
          <FieldWrapper label={t('family.sheet.gender')}>
            <View className="-mx-4">
              <FilterChips
                options={GENDERS.map((value) => ({ value, label: t(`gender.${value}`) }))}
                value={field.state.value ? [field.state.value] : []}
                onChange={(v) => field.handleChange((v[v.length - 1] ?? '') as typeof field.state.value)}
              />
            </View>
          </FieldWrapper>
        )}
      </form.Field>
    </FormSheet>
  );
}
