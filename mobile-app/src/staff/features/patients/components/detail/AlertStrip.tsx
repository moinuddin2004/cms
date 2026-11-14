import { View } from 'react-native';

import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

import type { PatientAlert } from '../../types/patients.types';

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
          className={cn('rounded-md border px-3 py-2', TONE[a.kind])}>
          <Text className="text-sm font-semibold">⚠ {a.title}</Text>
          <Text className="text-sm">{a.text}</Text>
        </View>
      ))}
    </View>
  );
}
