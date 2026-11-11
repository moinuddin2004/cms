import { View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';

export interface SectionHeaderProps {
  title: string;
  count?: number;
  action?: { label: string; onPress: () => void };
}

/** List section title with an optional count and a text action. */
export function SectionHeader({ title, count, action }: SectionHeaderProps) {
  return (
    <View className="min-h-11 flex-row items-center justify-between gap-2 px-4">
      <Text variant="h4" accessibilityRole="header" className="text-lg">
        {title}
        {count !== undefined ? <Text variant="muted">{`  ${count}`}</Text> : null}
      </Text>
      {action ? (
        <Button variant="link" size="sm" className="min-h-11" onPress={action.onPress}>
          <Text>{action.label}</Text>
        </Button>
      ) : null}
    </View>
  );
}
