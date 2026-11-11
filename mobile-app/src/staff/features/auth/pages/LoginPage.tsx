import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { View } from 'react-native';

import { FieldWrapper } from '@/core/components/forms/FieldWrapper';
import { fieldError } from '@/core/components/forms/fieldError';
import { FormInput } from '@/core/components/forms/FormInput';
import { Button } from '@/core/ui/button';
import { Switch } from '@/core/ui/switch';
import { Text } from '@/core/ui/text';

import { useLoginForm } from '../hooks/useLoginForm';

export function LoginPage() {
  const { form, globalError } = useLoginForm();

  return (
    <KeyboardAwareScrollView
      className="bg-background flex-1"
      contentContainerClassName="flex-grow justify-center gap-6 px-6 py-safe"
      keyboardShouldPersistTaps="handled">
      <View className="gap-1">
        <Text variant="h2" className="border-0 pb-0">
          Welcome back
        </Text>
        <Text variant="muted">Sign in to your clinic account.</Text>
      </View>

      {globalError ? (
        <View className="bg-destructive/10 rounded-md p-3">
          <Text className="text-destructive text-sm">{globalError}</Text>
        </View>
      ) : null}

      <View className="gap-4">
        <form.Field name="email">
          {(field) => (
            <FieldWrapper label="Email" error={fieldError(field)}>
              <FormInput
                invalid={!!fieldError(field)}
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={field.handleBlur}
                placeholder="you@clinic.com"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
              />
            </FieldWrapper>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <FieldWrapper label="Password" error={fieldError(field)}>
              <FormInput
                invalid={!!fieldError(field)}
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={field.handleBlur}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void form.handleSubmit()}
              />
            </FieldWrapper>
          )}
        </form.Field>

        <form.Field name="rememberMe">
          {(field) => (
            <View className="flex-row items-center justify-between">
              <Text className="text-sm">Keep me signed in</Text>
              <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
            </View>
          )}
        </form.Field>
      </View>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button disabled={!canSubmit || isSubmitting} onPress={() => void form.handleSubmit()}>
            <Text>{isSubmitting ? 'Signing in…' : 'Sign in'}</Text>
          </Button>
        )}
      </form.Subscribe>
    </KeyboardAwareScrollView>
  );
}
