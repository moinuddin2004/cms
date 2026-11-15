import { ArrowLeft } from 'lucide-react-native';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { usePendingClaimStore } from '@/core/claim/usePendingClaimStore';
import { FieldWrapper } from '@/core/components/forms/FieldWrapper';
import { fieldError } from '@/core/components/forms/fieldError';
import { FormInput } from '@/core/components/forms/FormInput';
import { useT } from '@/core/i18n';
import { switchSpace } from '@/core/space/switch-space';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

import { useSignInForm } from '../hooks/useSignInForm';

/**
 * Slot for "Continue with Google" (P-00). Empty until the native Google library
 * is installed (DECISIONS A-20) — the layout, divider and copy are ready for it.
 */
function GoogleSignInSlot() {
  return null;
}

/** P-00 sign-in: ask for an emailed code (docs/06). */
export function SignInPage() {
  const { t } = useT();
  const { form, globalError } = useSignInForm();
  const hasPendingClaim = usePendingClaimStore((s) => s.token !== null);

  return (
    <KeyboardAwareScrollView
      className="bg-background flex-1"
      contentContainerClassName="flex-grow justify-center gap-6 px-6 py-safe"
      keyboardShouldPersistTaps="handled">
      <Button
        variant="ghost"
        size="lg"
        className="min-h-11 self-start ps-0"
        accessibilityLabel={t('common.back')}
        onPress={() => switchSpace(null)}>
        <Icon as={ArrowLeft} className="size-5" />
        <Text>{t('common.back')}</Text>
      </Button>

      <View className="gap-1">
        <Text variant="h2" className="border-0 pb-0">
          {t('auth.signIn.title')}
        </Text>
        <Text variant="muted">{t('auth.signIn.subtitle')}</Text>
        {hasPendingClaim ? <Text className="text-primary">{t('claim.signInHint')}</Text> : null}
      </View>

      <GoogleSignInSlot />

      {globalError ? (
        <View className="bg-destructive/10 rounded-md p-3">
          <Text className="text-destructive text-sm">{globalError}</Text>
        </View>
      ) : null}

      <View className="gap-4">
        <form.Field name="email">
          {(field) => (
            <FieldWrapper label={t('auth.signIn.emailLabel')} error={fieldError(field)}>
              <FormInput
                invalid={!!fieldError(field)}
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={field.handleBlur}
                placeholder={t('auth.signIn.emailPlaceholder')}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="go"
                onSubmitEditing={() => void form.handleSubmit()}
              />
            </FieldWrapper>
          )}
        </form.Field>
      </View>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button disabled={!canSubmit || isSubmitting} onPress={() => void form.handleSubmit()}>
            <Text>{isSubmitting ? t('auth.signIn.sending') : t('auth.signIn.sendCode')}</Text>
          </Button>
        )}
      </form.Subscribe>

      <Text variant="muted" className="text-center text-xs">
        {t('auth.signIn.legal')}
      </Text>
    </KeyboardAwareScrollView>
  );
}
