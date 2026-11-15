import { ArrowLeft } from 'lucide-react-native';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { FieldWrapper } from '@/core/components/forms/FieldWrapper';
import { fieldError } from '@/core/components/forms/fieldError';
import { FormInput } from '@/core/components/forms/FormInput';
import { useT } from '@/core/i18n';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

import { useVerifyCodeForm } from '../hooks/useVerifyCodeForm';

/** P-00 code step: one 6-digit input with the one-time-code hint, resend after 60 s. */
export function VerifyCodePage() {
  const { t } = useT();
  const { form, email, globalError, notice, secondsLeft, resending, resend, changeEmail } =
    useVerifyCodeForm();

  return (
    <KeyboardAwareScrollView
      className="bg-background flex-1"
      contentContainerClassName="flex-grow justify-center gap-6 px-6 py-safe"
      keyboardShouldPersistTaps="handled">
      <Button
        variant="ghost"
        size="lg"
        className="min-h-11 self-start ps-0"
        accessibilityLabel={t('auth.verify.changeEmail')}
        onPress={changeEmail}>
        <Icon as={ArrowLeft} className="size-5" />
        <Text>{t('auth.verify.changeEmail')}</Text>
      </Button>

      <View className="gap-1">
        <Text variant="h2" className="border-0 pb-0">
          {t('auth.verify.title')}
        </Text>
        <Text variant="muted">{t('auth.verify.subtitle', { email: email ?? '' })}</Text>
      </View>

      {globalError ? (
        <View className="bg-destructive/10 rounded-md p-3">
          <Text className="text-destructive text-sm">{globalError}</Text>
        </View>
      ) : null}
      {notice ? <Text variant="muted">{notice}</Text> : null}

      <form.Field name="code">
        {(field) => (
          <FieldWrapper label={t('auth.verify.codeLabel')} error={fieldError(field)}>
            <FormInput
              invalid={!!fieldError(field)}
              value={field.state.value}
              onChangeText={(text) => field.handleChange(text.replace(/\D/g, '').slice(0, 6))}
              onBlur={field.handleBlur}
              placeholder={t('auth.verify.codePlaceholder')}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              autoCorrect={false}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              returnKeyType="go"
              onSubmitEditing={() => void form.handleSubmit()}
            />
          </FieldWrapper>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button disabled={!canSubmit || isSubmitting} onPress={() => void form.handleSubmit()}>
            <Text>{isSubmitting ? t('auth.verify.submitting') : t('auth.verify.submit')}</Text>
          </Button>
        )}
      </form.Subscribe>

      <Button
        variant="ghost"
        disabled={secondsLeft > 0 || resending}
        onPress={() => void resend()}>
        <Text>
          {secondsLeft > 0
            ? t('auth.verify.resendIn', { seconds: secondsLeft })
            : t('auth.verify.resend')}
        </Text>
      </Button>
    </KeyboardAwareScrollView>
  );
}
