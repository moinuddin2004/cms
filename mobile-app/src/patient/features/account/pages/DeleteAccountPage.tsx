import { TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  ConfirmDialog,
  fieldError,
  FieldWrapper,
  FormInput,
  Screen,
  ScreenHeader,
} from '@/core/components';
import { useT } from '@/core/i18n';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

import { useDeleteAccount } from '../hooks/useDeleteAccount';
import { useDeleteAccountForm } from '../hooks/useDeleteAccountForm';

/** P-09 Delete account: what goes, what stays, type DELETE, then a final destructive confirmation. */
export function DeleteAccountPage() {
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteAccount();
  const form = useDeleteAccountForm(() => setConfirming(true));

  const items = [
    t('account.delete.item1'),
    t('account.delete.item2'),
    t('account.delete.item3'),
    t('account.delete.item4'),
  ];

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      contentClassName="gap-5"
      header={
        <ScreenHeader
          title={t('account.delete.title')}
          subtitle={t('account.delete.subtitle')}
          backLabel={t('common.back')}
        />
      }>
      <View className="bg-destructive/10 flex-row items-start gap-3 rounded-xl p-4">
        <Icon as={TriangleAlert} className="text-destructive mt-0.5 size-5" />
        <View className="flex-1 gap-2">
          <Text variant="large">{t('account.delete.willDelete')}</Text>
          {items.map((item) => (
            <Text key={item} className="text-sm">
              {`• ${item}`}
            </Text>
          ))}
        </View>
      </View>
      <Text variant="muted">{t('account.delete.willKeep')}</Text>

      <form.Field name="confirm">
        {(field) => (
          <FieldWrapper label={t('account.delete.typeLabel')} error={fieldError(field)}>
            <FormInput
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              invalid={!!fieldError(field)}
              placeholder={t('account.delete.typePlaceholder')}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="done"
              onSubmitEditing={() => void form.handleSubmit()}
              accessibilityLabel={t('account.delete.typeLabel')}
            />
          </FieldWrapper>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting, s.values.confirm] as const}>
        {([canSubmit, isSubmitting, typed]) => (
          <Button
            variant="destructive"
            className="min-h-12"
            disabled={!canSubmit || isSubmitting || remove.isPending || typed.trim() === ''}
            onPress={() => void form.handleSubmit()}>
            <Text>{remove.isPending ? t('account.delete.submitting') : t('account.delete.submit')}</Text>
          </Button>
        )}
      </form.Subscribe>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('account.delete.confirmTitle')}
        description={t('account.delete.confirmBody')}
        confirmLabel={t('account.delete.confirmAction')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => remove.mutateAsync()}
      />
    </Screen>
  );
}
