import { View } from 'react-native';

import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

import type { StatusTone } from './status-tones';

export interface StatTileProps {
  label: string;
  value: string | number;
  /** Trend or context line under the value. */
  hint?: string;
  /** Colours the small marker beside the label; the value itself stays readable text. */
  tone?: StatusTone;
}

const MARKER: Record<StatusTone, string> = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

/** A number with its label (and optional hint). */
export function StatTile({ label, value, hint, tone }: StatTileProps) {
  return (
    <View
      accessible
      accessibilityLabel={[label, String(value), hint].filter(Boolean).join(', ')}
      className="border-border bg-card min-w-28 flex-1 gap-1 rounded-xl border p-4">
      <View className="flex-row items-center gap-2">
        {tone ? <View className={cn('size-2 rounded-full', MARKER[tone])} /> : null}
        <Text variant="muted">{label}</Text>
      </View>
      <Text variant="h3" className="tabular-nums">
        {value}
      </Text>
      {hint ? <Text variant="muted">{hint}</Text> : null}
    </View>
  );
}
