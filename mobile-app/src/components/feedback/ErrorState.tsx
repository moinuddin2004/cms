import { TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/** A load failed: message + retry. */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this. Check your connection and try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <View className="items-center gap-3 px-6 py-16">
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
          <Text>Try again</Text>
        </Button>
      ) : null}
    </View>
  );
}
