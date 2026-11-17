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
      {/* Tinted tile like the web EmptyState (bg-primary-soft, rounded-2xl). */}
      <View className="bg-primary/10 mb-1 size-14 items-center justify-center rounded-2xl">
        <Icon as={icon} className="text-primary size-7" />
      </View>
      <Text variant="large" accessibilityRole="header" className="text-center">
        {title}
      </Text>
      {description ? (
        <Text variant="muted" className="max-w-sm text-center">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button className="mt-2" onPress={onAction}>
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}
