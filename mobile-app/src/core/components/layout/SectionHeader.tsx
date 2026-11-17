import { View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

export interface SectionHeaderProps {
  title: string;
  count?: number;
  action?: { label: string; onPress: () => void };
  /**
   * Own horizontal padding (`px-4`, default) for full-bleed lists. Pass `false` inside an
   * already padded container (e.g. `Screen scroll`) so the title lines up with the content.
   */
  inset?: boolean;
}

/** List section title with an optional count and a text action. */
export function SectionHeader({ title, count, action, inset = true }: SectionHeaderProps) {
  return (
    <View className={cn('min-h-11 flex-row items-center justify-between gap-2', inset && 'px-4')}>
      <View className="flex-1 flex-row items-baseline gap-2">
        <Text variant="h3" accessibilityRole="header" className="text-start">
          {title}
        </Text>
        {count !== undefined ? <Text variant="muted">{count}</Text> : null}
      </View>
      {action ? (
        <Button variant="link" size="sm" className="min-h-11" onPress={action.onPress}>
          <Text>{action.label}</Text>
        </Button>
      ) : null}
    </View>
  );
}
