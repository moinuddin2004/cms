import { ChevronRight } from 'lucide-react-native';
import { I18nManager, View } from 'react-native';

import { Avatar, ListRow } from '@/core/components';
import { useT } from '@/core/i18n';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

import type { Profile } from '../types/profiles.types';

export interface ProfileCardProps {
  profile: Profile;
  onPress: () => void;
}

/** One person on the Family tab: avatar, name, relation and how many clinics they are linked to. */
export function ProfileCard({ profile, onPress }: ProfileCardProps) {
  const { t } = useT();
  const relation = profile.isSelf ? t('family.you') : t(`relation.${profile.relation}`);
  const links =
    profile.links.length === 0
      ? t('family.noLinks')
      : t('family.linkedCount', { count: profile.links.length });

  return (
    <View className="bg-card border-border overflow-hidden rounded-xl border">
      <ListRow
        leading={<Avatar name={profile.fullName} size="lg" />}
        title={profile.fullName}
        subtitle={`${relation} · ${links}`}
        trailing={
          <Icon
            as={ChevronRight}
            className={`text-muted-foreground size-5 ${I18nManager.isRTL ? 'rotate-180' : ''}`}
          />
        }
        onPress={onPress}
      />
    </View>
  );
}

export function ProfileCardHint({ text }: { text: string }) {
  return (
    <Text variant="muted" className="px-1 text-center text-sm">
      {text}
    </Text>
  );
}
