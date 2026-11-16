import { Building2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '@/core/components';
import { useT } from '@/core/i18n';
import { useProfiles } from '@/patient/features/profiles';

import { ClinicLinkCard } from '../components/ClinicLinkCard';
import { useLinks, useUnlinkClinic } from '../hooks/useLinks';
import { splitLinks } from '../lib/split-links';
import type { PatientLink } from '../types/clinics.types';

/**
 * P-08 Linked clinics: live links (with unlink), then revoked ones as history.
 * Unlinking is the patient's own revoke: the clinic's records leave the app,
 * the clinic keeps them. The list has no filters, so there is no "no results"
 * state, only empty / error / loading.
 */
export function ClinicsPage() {
  const { t } = useT();
  const links = useLinks();
  const profiles = useProfiles();
  const unlink = useUnlinkClinic();
  const [target, setTarget] = useState<PatientLink | null>(null);

  const nameOf = (profileId: string) =>
    profiles.data?.find((p) => p.id === profileId)?.fullName ?? '';
  const header = (
    <ScreenHeader title={t('clinics.title')} subtitle={t('clinics.subtitle')} backLabel={t('common.back')} />
  );

  if (links.isPending) {
    return <Screen header={header}><LoadingSkeleton rows={3} /></Screen>;
  }
  if (links.isError) {
    return (
      <Screen header={header}>
        <ErrorState
          title={t('clinics.loadFailed.title')}
          message={t('clinics.loadFailed.body')}
          retryLabel={t('common.retry')}
          onRetry={() => void links.refetch()}
        />
      </Screen>
    );
  }

  const { current, past } = splitLinks(links.data);
  if (current.length === 0 && past.length === 0) {
    return (
      <Screen header={header}>
        <EmptyState icon={Building2} title={t('clinics.empty.title')} description={t('clinics.empty.body')} />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      header={header}
      refreshing={links.isRefetching}
      onRefresh={() => void links.refetch()}
      contentClassName="gap-3">
      {current.length === 0 ? (
        <EmptyState icon={Building2} title={t('clinics.empty.title')} description={t('clinics.empty.body')} />
      ) : (
        <>
          <View className="-mx-4">
            <SectionHeader title={t('clinics.linked')} count={current.length} />
          </View>
          {current.map((link) => (
            <ClinicLinkCard
              key={link.id}
              link={link}
              profileName={nameOf(link.profileId)}
              onUnlink={() => setTarget(link)}
            />
          ))}
        </>
      )}

      {past.length > 0 ? (
        <>
          <View className="-mx-4">
            <SectionHeader title={t('clinics.history')} count={past.length} />
          </View>
          {past.map((link) => (
            <ClinicLinkCard key={link.id} link={link} profileName={nameOf(link.profileId)} />
          ))}
        </>
      ) : null}

      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title={t('clinics.unlinkTitle', { clinic: target?.clinic.name ?? '' })}
        description={t('clinics.unlinkBody', { clinic: target?.clinic.name ?? '' })}
        confirmLabel={t('clinics.unlinkConfirm')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={async () => {
          if (target) await unlink.mutateAsync(target.id);
        }}
      />
    </Screen>
  );
}
