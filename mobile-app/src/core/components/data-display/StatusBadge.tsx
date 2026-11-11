import { View } from 'react-native';

import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

import type { StatusTone, StatusToneVariant } from './status-tones';

export interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
  /** Defaults to `soft`. Spread a `status-tones` spec: `<StatusBadge {...QUEUE_STATUS_TONES[s]} />`. */
  variant?: StatusToneVariant;
  className?: string;
}

// Full literal class names (never built from strings) so Tailwind can see them.
const SOLID: Record<StatusTone, string> = {
  neutral: 'bg-foreground',
  primary: 'bg-primary',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};
const SOLID_TEXT: Record<StatusTone, string> = {
  neutral: 'text-background',
  primary: 'text-primary-foreground',
  info: 'text-info-foreground',
  success: 'text-success-foreground',
  warning: 'text-warning-foreground',
  destructive: 'text-destructive-foreground',
};
const SOFT: Record<StatusTone, string> = {
  neutral: 'bg-muted',
  primary: 'bg-primary/15',
  info: 'bg-info/15',
  success: 'bg-success/15',
  warning: 'bg-warning/15',
  destructive: 'bg-destructive/15',
};
const OUTLINE: Record<StatusTone, string> = {
  neutral: 'border-border',
  primary: 'border-primary',
  info: 'border-info',
  success: 'border-success',
  warning: 'border-warning',
  destructive: 'border-destructive',
};
const DOT: Record<StatusTone, string> = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

/**
 * Status pill. The tone is a colour, the label is the real signal (docs/04 §14).
 * `soft`/`outline` keep the text on `foreground` (a tinted background would not
 * give 4.5:1 for every tone) and show the tone as a dot.
 */
export function StatusBadge({ tone, label, variant = 'soft', className }: StatusBadgeProps) {
  const solid = variant === 'solid';
  return (
    <View
      accessible
      accessibilityLabel={label}
      className={cn(
        'flex-row items-center gap-1.5 self-start rounded-full border border-transparent px-2.5 py-1',
        solid && SOLID[tone],
        variant === 'soft' && SOFT[tone],
        variant === 'outline' && OUTLINE[tone],
        className,
      )}>
      {solid ? null : <View className={cn('size-2 rounded-full', DOT[tone])} />}
      <Text className={cn('text-xs font-medium', solid ? SOLID_TEXT[tone] : 'text-foreground')}>
        {label}
      </Text>
    </View>
  );
}
