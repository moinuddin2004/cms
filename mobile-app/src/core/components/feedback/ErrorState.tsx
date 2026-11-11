import { TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Label of the retry button; callers pass translated/inline copy. */
  retryLabel?: string;
  className?: string;
}

/** A load failed: message + retry. */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this. Check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
  className,
}: ErrorStateProps) {
  return (
    <View className={cn('items-center gap-3 px-6 py-16', className)}>
      <View className="bg-destructive/10 size-14 items-center justify-center rounded-full">
        <Icon as={TriangleAlert} className="text-destructive size-6" />
      </View>
      <Text variant="large" className="text-center">
        {title}
      </Text>
      <Text variant="muted" className="text-center">
        {message}
      </Text>
      {onRetry ? (
        <Button variant="outline" onPress={onRetry}>
          <Text>{retryLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}
