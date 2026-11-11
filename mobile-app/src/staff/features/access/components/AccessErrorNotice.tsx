import { View } from 'react-native';

import { ErrorState } from '@/core/components/feedback/ErrorState';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';

import { useAccess } from './AccessProvider';

const TITLE = 'Could not load your permissions';
const MESSAGE = 'Check your connection and try again.';

/** Full-size failure state for a screen (More). Renders nothing unless `/me/access` failed. */
export function AccessErrorState({ className }: { className?: string }) {
  const access = useAccess();
  if (access.status !== 'error') return null;
  return (
    <ErrorState title={TITLE} message={MESSAGE} onRetry={access.refetch} className={className} />
  );
}

/** Slim banner above the tab bar's screens; renders nothing unless `/me/access` failed. */
export function AccessErrorBanner() {
  const access = useAccess();
  if (access.status !== 'error') return null;
  return (
    <View
      accessibilityRole="alert"
      className="bg-destructive/10 flex-row items-center justify-between gap-3 px-4 py-2">
      <Text className="text-destructive flex-1 text-sm">{TITLE}</Text>
      <Button size="sm" variant="outline" onPress={access.refetch}>
        <Text>Retry</Text>
      </Button>
    </View>
  );
}
