import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { FieldWrapper } from '@/core/components/forms/FieldWrapper';
import { fieldError } from '@/core/components/forms/fieldError';
import { FormInput } from '@/core/components/forms/FormInput';
import { useT } from '@/core/i18n';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';

import { useNameForm } from '../hooks/useNameForm';

/** "What should we call you?" — shown once, after the first sign-in of a new account (P-00). */
export function NamePage() {
  const { t } = useT();
  const { form, globalError } = useNameForm();

  return (
    <KeyboardAwareScrollView
      className="bg-background flex-1"
      contentContainerClassName="flex-grow justify-center gap-6 px-6 py-safe"
      keyboardShouldPersistTaps="handled">
      <View className="gap-1">
        <Text variant="h2" className="border-0 pb-0">
          {t('auth.name.title')}
        </Text>
        <Text variant="muted">{t('auth.name.subtitle')}</Text>
      </View>

      {globalError ? (
        <View className="bg-destructive/10 rounded-md p-3">
          <Text className="text-destructive text-sm">{globalError}</Text>
        </View>
      ) : null}

      <form.Field name="fullName">
        {(field) => (
          <FieldWrapper label={t('auth.name.label')} error={fieldError(field)}>
            <FormInput
              invalid={!!fieldError(field)}
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              placeholder={t('auth.name.placeholder')}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="go"
              onSubmitEditing={() => void form.handleSubmit()}
            />
          </FieldWrapper>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button disabled={!canSubmit || isSubmitting} onPress={() => void form.handleSubmit()}>
            <Text>{isSubmitting ? t('auth.name.saving') : t('auth.name.submit')}</Text>
          </Button>
        )}
      </form.Subscribe>
    </KeyboardAwareScrollView>
  );
}
