import { PauseCircle } from 'lucide-react-native';
import { View } from 'react-native';

import { useT } from '@/core/i18n';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

import { clinicAccent, isClinicPaused } from '../lib/clinic';
import type { ClinicRef } from '../types/records.types';

/**
 * The clinic a record belongs to: its colour as a small accent stripe (A-11,
 * accent only) + its name, and a calm "paused" note for a suspended clinic (A-19).
 */
export function ClinicChip({ clinic, place }: { clinic: ClinicRef; place?: string }) {
  const { t } = useT();
  const accent = clinicAccent(clinic);
  const paused = isClinicPaused(clinic);
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <View className="bg-muted flex-row items-center gap-2 self-start rounded-full py-1 pe-3 ps-2">
        <View
          className="bg-primary h-4 w-1.5 rounded-full"
          style={accent ? { backgroundColor: accent } : undefined}
        />
        <Text className="text-sm font-medium" numberOfLines={1}>
          {place ? `${clinic.name} · ${place}` : clinic.name}
        </Text>
      </View>
      {paused ? (
        <View
          accessible
          accessibilityLabel={t('records.clinicPaused')}
          className="border-border flex-row items-center gap-1.5 rounded-full border px-2.5 py-1">
          <Icon as={PauseCircle} className="text-muted-foreground size-4" />
          <Text className="text-muted-foreground text-xs font-medium">{t('records.clinicPaused')}</Text>
        </View>
      ) : null}
    </View>
  );
}
