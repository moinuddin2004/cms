import { useRouter } from 'expo-router';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import {
  Avatar,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingSkeleton,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '@/core/components';
import { formatYmd } from '@/core/datetime';
import { useT } from '@/core/i18n';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

import { ProfileFormSheet } from '../components/ProfileFormSheet';
import { ProfileLinkRow } from '../components/ProfileLinkRow';
import { useRemoveProfile } from '../hooks/useProfileMutations';
import { useProfiles } from '../hooks/useProfiles';

export interface ProfileDetailPageProps {
  profileId: string;
}

/**
 * Profile detail: own profile data (name, relation, date of birth, gender),
 * the clinics this person is linked to, edit and remove. Reads the profiles
 * list (one request, already cached by the Family tab).
 */
export function ProfileDetailPage({ profileId }: ProfileDetailPageProps) {
  const { t } = useT();
  const router = useRouter();
  const profiles = useProfiles();
  const remove = useRemoveProfile();
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const profile = profiles.data?.find((p) => p.id === profileId);
  const header = (title: string, actions?: ReactNode) => (
    <ScreenHeader title={title} backLabel={t('common.back')} actions={actions} />
  );

  if (profiles.isPending) {
    return <Screen header={header(t('family.detail.title'))}><LoadingSkeleton rows={3} /></Screen>;
  }
  if (profiles.isError) {
    return (
      <Screen header={header(t('family.detail.title'))}>
        <ErrorState
          title={t('family.detail.loadFailed.title')}
          message={t('family.detail.loadFailed.body')}
          retryLabel={t('common.retry')}
          onRetry={() => void profiles.refetch()}
        />
      </Screen>
    );
  }
  if (!profile) {
    return (
      <Screen header={header(t('family.detail.title'))}>
        <EmptyState title={t('family.detail.notFound.title')} description={t('family.detail.notFound.body')} />
      </Screen>
    );
  }

  const facts = [
    profile.isSelf ? t('family.you') : t(`relation.${profile.relation}`),
    profile.gender ? t(`gender.${profile.gender}`) : null,
    profile.dob ? t('family.detail.born', { date: formatYmd(profile.dob) }) : null,
  ].filter(Boolean);
  const hasLinks = profile.links.length > 0;

  return (
    <Screen
      scroll
      refreshing={profiles.isRefetching}
      onRefresh={() => void profiles.refetch()}
      contentClassName="gap-4"
      header={header(
        profile.fullName,
        <IconButton
          icon={Pencil}
          accessibilityLabel={t('family.detail.edit')}
          onPress={() => setEditing(true)}
        />,
      )}>
      <View className="items-center gap-2 py-2">
        <Avatar name={profile.fullName} size="lg" />
        <Text variant="muted" className="text-center">
          {facts.join(' · ')}
        </Text>
      </View>

      <View className="-mx-4 gap-1">
        <SectionHeader title={t('family.detail.links')} count={profile.links.length} />
        {hasLinks ? (
          profile.links.map((link) => <ProfileLinkRow key={link.id} link={link} />)
        ) : (
          <Text variant="muted" className="px-4">
            {t('family.detail.noLinks')}
          </Text>
        )}
      </View>

      {hasLinks ? (
        <Button variant="outline" className="min-h-11" onPress={() => router.push('/clinics')}>
          <Text>{t('family.detail.manageClinics')}</Text>
        </Button>
      ) : null}

      {profile.isSelf ? null : (
        <View className="gap-1">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={hasLinks || remove.isPending}
            onPress={() => setConfirmingRemove(true)}>
            <Icon as={Trash2} className="text-destructive size-4" />
            <Text className="text-destructive">{t('family.detail.remove')}</Text>
          </Button>
          {hasLinks ? (
            <Text variant="muted" className="text-center text-xs">
              {t('family.detail.removeBlocked')}
            </Text>
          ) : null}
        </View>
      )}

      <ProfileFormSheet open={editing} onClose={() => setEditing(false)} profile={profile} />
      <ConfirmDialog
        open={confirmingRemove}
        onClose={() => setConfirmingRemove(false)}
        title={t('family.detail.removeTitle', { name: profile.fullName })}
        description={t('family.detail.removeBody')}
        confirmLabel={t('family.detail.removeConfirm')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(profile.id);
          toast.success(t('family.detail.removed'));
          router.back();
        }}
      />
    </Screen>
  );
}
