import type { ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { cn } from '@/core/utils';

export interface ScreenProps {
  children: ReactNode;
  /** Scrolls the body and keeps the focused field above the keyboard. */
  scroll?: boolean;
  /** Pull-to-refresh (only with `scroll`). */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Usually a `ScreenHeader`; stays fixed above the body. */
  header?: ReactNode;
  /** Slot for `OfflineBanner`; sits above the header. */
  banner?: ReactNode;
  /** Which safe-area edges to pad. Tab screens pass `['top']` (the tab bar owns the bottom). */
  edges?: ('top' | 'bottom')[];
  className?: string;
  contentClassName?: string;
}

/** Wraps every page: background, safe area, banner/header slots, refresh, keyboard handling. */
export function Screen({
  children,
  scroll = false,
  refreshing = false,
  onRefresh,
  header,
  banner,
  edges = ['top', 'bottom'],
  className,
  contentClassName,
}: ScreenProps) {
  return (
    <View
      className={cn(
        'bg-background flex-1',
        edges.includes('top') && 'pt-safe',
        edges.includes('bottom') && 'pb-safe',
        className,
      )}>
      {banner}
      {header}
      {scroll ? (
        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerClassName={cn('gap-6 px-4 pb-6', contentClassName)}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
          }>
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <View className={cn('flex-1', contentClassName)}>{children}</View>
      )}
    </View>
  );
}
