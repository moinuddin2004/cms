import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, StatusBadge } from '@/core/components';
import { deviceTimezone, formatInZone } from '@/core/datetime';
import { useT } from '@/core/i18n';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';

import type { PatientLink } from '../types/clinics.types';
import { LinkHistory } from './LinkHistory';

export interface ClinicLinkCardProps {
  link: PatientLink;
  /** Whose records this link carries. */
  profileName: string;
  /** Live links can be unlinked; revoked ones only show their history. */
  onUnlink?: () => void;
}

/** One clinic link: who, where, since when, status, and unlink / history actions. */
export function ClinicLinkCard({ link, profileName, onUnlink }: ClinicLinkCardProps) {
  const { t } = useT();
  const [historyOpen, setHistoryOpen] = useState(false);
  const zone = link.location?.timezone ?? deviceTimezone();
  const day = (iso: string) => formatInZone(iso, zone, 'MMM d, yyyy');

  const revokedText =
    link.status === 'revoked' && link.revokedAt
      ? t(`clinics.revoked.${link.revokedBy ?? 'unknown'}`, { date: day(link.revokedAt) })
      : null;
  const readOnly = link.status === 'frozen' || link.clinic.clinicStatus === 'suspended';

  return (
    <View className="bg-card border-border gap-3 rounded-xl border p-4">
      <View className="flex-row items-center gap-3">
        <Avatar name={link.clinic.name} imageUrl={link.clinic.logoUrl} size="lg" />
        <View className="flex-1 gap-0.5">
          <Text variant="large" numberOfLines={2}>
            {link.clinic.name}
          </Text>
          {link.location ? (
            <Text variant="muted" numberOfLines={1}>
              {link.location.name}
            </Text>
          ) : null}
        </View>
        {readOnly && link.status !== 'revoked' ? (
          <StatusBadge tone="warning" label={t('clinics.frozen')} />
        ) : null}
      </View>

      <View className="gap-0.5">
        <Text className="text-sm">{t('clinics.forProfile', { name: profileName })}</Text>
        <Text variant="muted" className="text-sm">
          {t('clinics.since', { date: day(link.linkedAt) })}
        </Text>
        <Text variant="muted" className="text-sm">
          {t('clinics.linkedBy', { clinic: link.clinic.name })}
        </Text>
        {revokedText ? <Text className="text-destructive text-sm">{revokedText}</Text> : null}
      </View>

      {historyOpen ? <LinkHistory linkId={link.id} timezone={link.location?.timezone} /> : null}

      <View className="flex-row flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" onPress={() => setHistoryOpen((v) => !v)}>
          <Text>{historyOpen ? t('clinics.hideHistory') : t('clinics.showHistory')}</Text>
        </Button>
        {onUnlink ? (
          <Button variant="destructive" className="min-h-11" onPress={onUnlink}>
            <Text>{t('clinics.unlink')}</Text>
          </Button>
        ) : null}
      </View>
    </View>
  );
}
