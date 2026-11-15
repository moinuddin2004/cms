import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { I18nManager, Pressable, View } from 'react-native';

import { Icon } from '@/core/ui/icon';

/** A big, plain card for one record (docs/05 patient look). */
export function RecordCard({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!onPress}
      onPress={onPress}
      className="border-border bg-card active:bg-accent min-h-16 flex-row items-center gap-3 rounded-xl border p-4">
      <View className="flex-1 gap-2">{children}</View>
      {onPress ? (
        <Icon
          as={ChevronRight}
          className="text-muted-foreground size-5"
          style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
        />
      ) : null}
    </Pressable>
  );
}
