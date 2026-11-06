import type { LucideIcon } from 'lucide-react-native';
import { Inbox } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Nothing here yet: icon + message + call to action. */
export function EmptyState({ icon = Inbox, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="items-center gap-3 px-6 py-16">
      <View className="bg-muted size-14 items-center justify-center rounded-full">
        <Icon as={icon} className="text-muted-foreground size-6" />
      </View>
      <Text variant="large" className="text-center">
        {title}
      </Text>
      {description ? (
        <Text variant="muted" className="text-center">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button onPress={onAction}>
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}
