import type { LucideIcon } from 'lucide-react-native';
import { Inbox } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Override the default centred padding when the state fills a `Screen`. */
  className?: string;
}

/** Nothing here yet: icon + message + call to action. */
export function EmptyState({ icon = Inbox, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <View className={cn('items-center gap-3 px-6 py-16', className)}>
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
