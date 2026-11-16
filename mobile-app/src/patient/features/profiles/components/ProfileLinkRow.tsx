import { View } from 'react-native';

import { Avatar, ListRow, StatusBadge } from '@/core/components';
import { deviceTimezone, formatInZone } from '@/core/datetime';
import { useT } from '@/core/i18n';

import type { ProfileLink } from '../types/profiles.types';

export interface ProfileLinkRowProps {
  link: ProfileLink;
}

/** A clinic this profile is linked to. The date is shown on that clinic's clock (A-10). */
export function ProfileLinkRow({ link }: ProfileLinkRowProps) {
  const { t } = useT();
  const zone = link.location?.timezone ?? deviceTimezone();
  const date = formatInZone(link.linkedAt, zone, 'MMM d, yyyy');
  const place = [link.location?.name, t('family.detail.linkedSince', { date })].filter(Boolean).join(' · ');

  return (
    <View>
      <ListRow
        leading={<Avatar name={link.clinic.name} imageUrl={link.clinic.logoUrl} />}
        title={link.clinic.name}
        subtitle={place}
        trailing={
          link.status === 'frozen' || link.clinic.clinicStatus === 'suspended' ? (
            <StatusBadge tone="warning" label={t('family.detail.readOnly')} />
          ) : undefined
        }
      />
    </View>
  );
}
