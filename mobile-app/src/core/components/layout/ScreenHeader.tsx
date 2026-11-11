import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { I18nManager, View } from 'react-native';

import { Text } from '@/core/ui/text';

import { IconButton } from './IconButton';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * Back arrow. `undefined` = automatic (shown when the router has history),
   * `true` forces it, `false` hides it.
   */
  back?: boolean;
  /** Accessibility label of the back arrow; callers pass it (core never translates). */
  backLabel?: string;
  /** Right side: `IconButton`s (each carries its own label). */
  actions?: ReactNode;
}

/** Large title + subtitle + right-hand actions, with an automatic back arrow. */
export function ScreenHeader({
  title,
  subtitle,
  back,
  backLabel = 'Back',
  actions,
}: ScreenHeaderProps) {
  const router = useRouter();
  const showBack = back ?? router.canGoBack();

  return (
    <View className="flex-row items-center gap-2 px-4 py-3">
      {showBack ? (
        <IconButton
          icon={I18nManager.isRTL ? ChevronRight : ChevronLeft}
          accessibilityLabel={backLabel}
          onPress={() => router.back()}
          className="-ms-2"
        />
      ) : null}
      <View className="flex-1 gap-0.5">
        <Text variant="h2" className="border-0 pb-0 text-start">
          {title}
        </Text>
        {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
      </View>
      {actions ? <View className="flex-row items-center gap-1">{actions}</View> : null}
    </View>
  );
}
