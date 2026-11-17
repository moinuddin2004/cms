import { TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from '@/core/ui/icon';

import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

import type { PatientAlert } from '../../types/patients.types';

const ICON: Record<PatientAlert['kind'], string> = {
  allergy: 'text-destructive',
  blacklist: 'text-destructive',
  minor: 'text-warning',
};

const TONE: Record<PatientAlert['kind'], string> = {
  allergy: 'bg-destructive/10 border-destructive',
  blacklist: 'bg-destructive/10 border-destructive',
  minor: 'bg-warning/15 border-warning',
};

/** Allergies / blacklisted / minor+guardian strip (docs/06 S-05). The text carries the meaning; colour only supports it. */
export function AlertStrip({ alerts }: { alerts: PatientAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <View className="gap-2 px-4 pb-2">
      {alerts.map((a) => (
        <View
          key={a.kind}
          accessible
          accessibilityRole="alert"
          accessibilityLabel={`${a.title}: ${a.text}`}
          className={cn('flex-row gap-2 rounded-xl border px-3 py-2', TONE[a.kind])}>
          <Icon as={TriangleAlert} className={cn('mt-0.5 size-4', ICON[a.kind])} />
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-semibold">{a.title}</Text>
            <Text className="text-sm">{a.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
