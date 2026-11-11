import { View } from 'react-native';

import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

export interface TokenBadgeProps {
  /** Display token, e.g. "A-007". */
  token: string;
  size?: 'sm' | 'md' | 'lg';
  accessibilityLabel?: string;
}

const BOX = { sm: 'px-2 py-0.5', md: 'px-3 py-1', lg: 'px-5 py-2' } as const;
const TEXT = { sm: 'text-sm', md: 'text-xl', lg: 'text-4xl' } as const;

/** Big tabular token number. Always tabular numerals so digits do not jump (docs/05 §3). */
export function TokenBadge({ token, size = 'md', accessibilityLabel }: TokenBadgeProps) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? token}
      className={cn('border-border bg-card self-start rounded-md border', BOX[size])}>
      <Text className={cn('font-bold tracking-tight tabular-nums', TEXT[size])}>{token}</Text>
    </View>
  );
}
