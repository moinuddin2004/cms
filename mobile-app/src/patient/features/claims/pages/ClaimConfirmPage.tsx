import { useRouter } from 'expo-router';
import { CircleCheck, Link2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { usePendingClaimStore } from '@/core/claim/usePendingClaimStore';
import { ErrorState, LoadingSkeleton } from '@/core/components';
import { FieldWrapper } from '@/core/components/forms/FieldWrapper';
import { fieldError } from '@/core/components/forms/fieldError';
import { FormInput } from '@/core/components/forms/FormInput';
import { useT } from '@/core/i18n';
import type { MessageKey } from '@/core/i18n';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Switch } from '@/core/ui/switch';
import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

import { useClaimForm } from '../hooks/useClaimForm';
import { useClaimPreview } from '../hooks/useClaimPreview';
import { claimErrorInfo } from '../lib/claim-errors';
import type { ClaimFormValues } from '../schemas/claim.schema';
import type { AcceptClaimResult, ClaimPreview } from '../types/claims.types';

const OPTIONS: { value: ClaimFormValues['relation']; label: MessageKey }[] = [
  { value: 'self', label: 'claim.confirm.relSelf' },
  { value: 'child', label: 'claim.confirm.relChild' },
  { value: 'parent', label: 'claim.confirm.relParent' },
  { value: 'other', label: 'claim.confirm.relOther' },
];

const ageText = (band: ClaimPreview['ageBand']) => (band ? band.replace('-', '–') : null);

/** Leave the claim flow: drop the token and go to the patient home. */
function useLeave() {
  const router = useRouter();
  return () => {
    usePendingClaimStore.getState().clear();
    router.replace('/');
  };
}

function Done({ clinic, onDone }: { clinic: string; onDone: () => void }) {
  const { t } = useT();
  return (
    <View className="bg-background py-safe flex-1 items-center justify-center gap-4 px-6">
      <View className="bg-primary/10 size-16 items-center justify-center rounded-full">
        <Icon as={CircleCheck} className="text-primary size-8" />
      </View>
      <Text variant="h3" className="text-center">
        {t('claim.success.title')}
      </Text>
      <Text className="text-center">{t('claim.success.body', { clinic })}</Text>
      <Button size="lg" className="min-h-11 self-stretch" onPress={onDone}>
        <Text>{t('claim.success.done')}</Text>
      </Button>
    </View>
  );
}

function Failure({ messageKey, onLeave }: { messageKey: MessageKey; onLeave: () => void }) {
  const { t } = useT();
  return (
    <View className="bg-background py-safe flex-1 justify-center px-6">
      <ErrorState
        title={t('claim.invalid.title')}
        message={t(messageKey)}
        retryLabel={t('claim.invalid.action')}
        onRetry={onLeave}
      />
    </View>
  );
}

interface ConfirmFormProps {
  token: string;
  preview: ClaimPreview;
  onLinked: (r: AcceptClaimResult) => void;
  onLeave: () => void;
}

function ConfirmForm({ token, preview, onLinked, onLeave }: ConfirmFormProps) {
  const { t } = useT();
  const { form, globalError } = useClaimForm(token, preview.isMinor, onLinked, onLeave);
  const age = ageText(preview.ageBand);
  const options = preview.isMinor ? OPTIONS.filter((o) => o.value !== 'self') : OPTIONS;

  return (
    <KeyboardAwareScrollView
      className="bg-background flex-1"
      contentContainerClassName="flex-grow gap-5 px-6 py-safe"
      keyboardShouldPersistTaps="handled">
      <View className="gap-1 pt-4">
        <Text variant="h2" className="border-0 pb-0">
          {t('claim.confirm.title')}
        </Text>
        <Text variant="large">{`${preview.clinic.name}, ${preview.location.name}`}</Text>
        <Text variant="muted">
          {age
            ? t('claim.confirm.recordAge', { name: preview.maskedName, age })
            : t('claim.confirm.record', { name: preview.maskedName })}
        </Text>
      </View>

      {preview.alreadyLinkedToYou ? (
        <View className="bg-muted rounded-md p-3">
          <Text className="text-sm">{t('claim.confirm.alreadyYours')}</Text>
        </View>
      ) : null}

      {globalError ? (
        <View className="bg-destructive/10 rounded-md p-3">
          <Text className="text-destructive text-sm">{globalError}</Text>
        </View>
      ) : null}

      <form.Field name="relation">
        {(field) => (
          <View className="gap-2" accessibilityRole="radiogroup">
            <Text variant="large">{t('claim.confirm.whose')}</Text>
            {options.map((o) => {
              const selected = field.state.value === o.value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => field.handleChange(o.value)}
                  className={cn(
                    'min-h-11 flex-row items-center gap-3 rounded-md border px-3 py-2',
                    selected ? 'border-primary bg-primary/10' : 'border-border',
                  )}>
                  <View
                    className={cn(
                      'size-5 items-center justify-center rounded-full border-2',
                      selected ? 'border-primary' : 'border-muted-foreground',
                    )}>
                    {selected ? <View className="bg-primary size-2.5 rounded-full" /> : null}
                  </View>
                  <Text>{t(o.label)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => s.values.relation}>
        {(relation) =>
          relation === 'self' ? null : (
            <form.Field name="newProfileName">
              {(field) => (
                <FieldWrapper label={t('claim.confirm.nameLabel')} error={fieldError(field)}>
                  <FormInput
                    invalid={!!fieldError(field)}
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    placeholder={t('claim.confirm.namePlaceholder')}
                    autoCapitalize="words"
                    autoComplete="off"
                    returnKeyType="done"
                  />
                </FieldWrapper>
              )}
            </form.Field>
          )
        }
      </form.Subscribe>

      <form.Field name="confirm">
        {(field) => (
          <View className="min-h-11 flex-row items-center gap-3">
            <Switch
              checked={field.state.value}
              onCheckedChange={field.handleChange}
              accessibilityLabel={t('claim.confirm.consent')}
            />
            <Text className="flex-1 text-sm">{t('claim.confirm.consent')}</Text>
          </View>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <View className="gap-2">
            <Button
              size="lg"
              className="min-h-11"
              disabled={!canSubmit || isSubmitting}
              accessibilityState={{ busy: isSubmitting, disabled: !canSubmit || isSubmitting }}
              onPress={() => void form.handleSubmit()}>
              <Icon as={Link2} className="text-primary-foreground size-5" />
              <Text>
                {isSubmitting ? t('claim.confirm.submitting') : t('claim.confirm.submit')}
              </Text>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="min-h-11"
              disabled={isSubmitting}
              onPress={onLeave}>
              <Text>{t('claim.confirm.cancel')}</Text>
            </Button>
          </View>
        )}
      </form.Subscribe>
    </KeyboardAwareScrollView>
  );
}

/** P-01 confirm page: preview the clinic record, ask whose it is, accept (docs/06). */
export function ClaimConfirmPage() {
  const { t } = useT();
  const token = usePendingClaimStore((s) => s.token);
  const leave = useLeave();
  const preview = useClaimPreview(token);
  const [done, setDone] = useState<AcceptClaimResult | null>(null);

  // Keep showing the success screen after the token is cleared by `leave`.
  if (done) return <Done clinic={done.link.clinic.name} onDone={leave} />;

  if (!token) return <Failure messageKey="claim.errors.invalid" onLeave={leave} />;

  if (preview.isPending) {
    return (
      <View className="bg-background py-safe flex-1 gap-4 px-6">
        <Text variant="muted" className="pt-6">
          {t('claim.confirm.loading')}
        </Text>
        <LoadingSkeleton rows={4} />
      </View>
    );
  }

  if (preview.isError) {
    const info = claimErrorInfo(preview.error);
    if (info.terminal) return <Failure messageKey={info.key} onLeave={leave} />;
    return (
      <View className="bg-background py-safe flex-1 justify-center px-6">
        <ErrorState
          title={t('claim.invalid.title')}
          message={t(info.key)}
          retryLabel={t('common.retry')}
          onRetry={() => void preview.refetch()}
        />
      </View>
    );
  }

  return <ConfirmForm token={token} preview={preview.data} onLinked={setDone} onLeave={leave} />;
}
