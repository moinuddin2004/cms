import { useRouter } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';
import { useState } from 'react';

import {
  EmptyState,
  ErrorState,
  IconButton,
  LoadingSkeleton,
  Screen,
  ScreenHeader,
} from '@/core/components';
import { useT } from '@/core/i18n';

import { ProfileCard, ProfileCardHint } from '../components/ProfileCard';
import { ProfileFormSheet } from '../components/ProfileFormSheet';
import { useProfiles } from '../hooks/useProfiles';

/**
 * P-04 Family: the account's people (you + family) with their linked-clinic
 * counts. Adding a person creates the profile only; the link itself comes from
 * the clinic reception's code (claim flow).
 */
export function FamilyPage() {
  const { t } = useT();
  const router = useRouter();
  const profiles = useProfiles();
  const [adding, setAdding] = useState(false);

  const open = (profileId: string) =>
    router.push({ pathname: '/profiles/[profileId]', params: { profileId } });

  let body;
  if (profiles.isPending) {
    body = <LoadingSkeleton rows={3} />;
  } else if (profiles.isError) {
    body = (
      <ErrorState
        title={t('family.loadFailed.title')}
        message={t('family.loadFailed.body')}
        retryLabel={t('common.retry')}
        onRetry={() => void profiles.refetch()}
      />
    );
  } else if (profiles.data.length === 0) {
    body = (
      <EmptyState
        icon={Users}
        title={t('family.empty.title')}
        description={t('family.empty.body')}
        actionLabel={t('family.add')}
        onAction={() => setAdding(true)}
      />
    );
  } else {
    body = (
      <>
        {profiles.data.map((profile) => (
          <ProfileCard key={profile.id} profile={profile} onPress={() => open(profile.id)} />
        ))}
        <ProfileCardHint text={t('family.addHint')} />
      </>
    );
  }

  return (
    <Screen
      scroll
      refreshing={profiles.isRefetching}
      onRefresh={() => void profiles.refetch()}
      contentClassName="gap-3"
      header={
        <ScreenHeader
          title={t('family.title')}
          subtitle={t('family.subtitle')}
          backLabel={t('common.back')}
          actions={
            <IconButton icon={Plus} accessibilityLabel={t('family.add')} onPress={() => setAdding(true)} />
          }
        />
      }>
      {body}
      <ProfileFormSheet open={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}
