import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

export interface ListRowProps {
  /** Avatar or icon. */
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  /** Small right-aligned text (time, count). */
  meta?: string;
  /** Right-hand node (badge, chevron). */
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Overrides the sentence a screen reader reads (default: title, subtitle, meta). */
  accessibilityLabel?: string;
  className?: string;
}

/** Standard tappable row. Reads as one sentence to a screen reader (docs/05 §8). */
export function ListRow({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  onPress,
  onLongPress,
  disabled,
  accessibilityLabel,
  className,
}: ListRowProps) {
  const interactive = !!(onPress || onLongPress);
  return (
    <Pressable
      accessible
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, meta].filter(Boolean).join(', ')}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || !interactive}
      onPress={onPress}
      onLongPress={onLongPress}
      className={cn(
        'min-h-14 flex-row items-center gap-3 px-4 py-3',
        interactive && 'active:bg-accent',
        disabled && 'opacity-50',
        className,
      )}>
      {leading}
      <View className="flex-1 gap-0.5">
        <Text variant="large" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {meta ? <Text variant="muted">{meta}</Text> : null}
      {trailing}
    </Pressable>
  );
}
