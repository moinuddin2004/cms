import { View } from 'react-native';

import { deviceTimezone, formatInZone } from '@/core/datetime';
import { useT } from '@/core/i18n';
import { Text } from '@/core/ui/text';

import { useLinkHistory } from '../hooks/useLinks';

export interface LinkHistoryProps {
  linkId: string;
  /** IANA zone of the clinic's location: events are shown on its clock. */
  timezone?: string;
}

/** The events of one link (linked, unlinked by you / the clinic), loaded when first shown. */
export function LinkHistory({ linkId, timezone }: LinkHistoryProps) {
  const { t } = useT();
  const history = useLinkHistory(linkId, true);
  const zone = timezone ?? deviceTimezone();

  if (history.isPending) return <Text variant="muted">{t('clinics.historyLoading')}</Text>;
  if (history.isError) return <Text className="text-destructive text-sm">{t('clinics.historyFailed')}</Text>;
  if (history.data.length === 0) return <Text variant="muted">{t('clinics.historyEmpty')}</Text>;

  return (
    <View className="gap-1.5">
      {history.data.map((entry) => (
        <View key={`${entry.action}-${entry.at}`} className="flex-row items-baseline justify-between gap-3">
          <Text className="flex-1 text-sm">{t(`clinics.event.${entry.action}`)}</Text>
          <Text variant="muted" className="text-xs">
            {formatInZone(entry.at, zone, 'MMM d, yyyy')}
          </Text>
        </View>
      ))}
    </View>
  );
}
