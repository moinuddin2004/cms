import { useRouter } from 'expo-router';
import { Ticket } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useT } from '@/core/i18n';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

import { useActiveQueue } from '../hooks/useActiveQueue';
import { cardLine, isCalled } from '../lib/queue-text';
import type { ActiveQueueEntry } from '../types/queue.types';

/** One live token ("Token A-014 · 3 ahead · Dr Sana"); tapping opens the visit screen (P-06). */
export function LiveTokenCard({ entry }: { entry: ActiveQueueEntry }) {
  const { t } = useT();
  const router = useRouter();
  const called = isCalled(entry);
  const line = cardLine(t, entry);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.clinic.name}. ${line}`}
      onPress={() => router.push(`/visit/${entry.entryId}`)}
      className={cn(
        'min-h-11 flex-row items-center gap-3 rounded-xl border p-4 active:opacity-80',
        called ? 'border-primary bg-primary/10' : 'border-border bg-card',
      )}>
      <View className="bg-muted size-10 items-center justify-center rounded-full">
        <Icon as={Ticket} className="text-foreground size-5" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-medium">{entry.clinic.name}</Text>
        <Text variant="muted">{line}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Every active queue entry of the account as live cards; renders nothing when there is none (and
 * while loading or failing: the card is an extra, never an error screen). Pin it at the top of the
 * Today/home screen.
 */
export function LiveTokenSection() {
  const { data } = useActiveQueue();
  if (!data || data.length === 0) return null;
  return (
    <View className="gap-2">
      {data.map((e) => (
        <LiveTokenCard key={e.entryId} entry={e} />
      ))}
    </View>
  );
}
