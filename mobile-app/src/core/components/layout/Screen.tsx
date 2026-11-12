import type { ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { OfflineBanner } from '@/core/components/feedback/OfflineBanner';
import { useOnline } from '@/core/network';
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
  /** Overrides the automatic offline banner; sits above the header. */
  banner?: ReactNode;
  /** Clinic-clock time ("hh:mm") of the screen's newest data, for the offline banner. */
  savedAt?: string;
  /** Rendered outside the scroll container, above the body (FAB, floating bar). */
  floating?: ReactNode;
  /** Safe-area edges to pad. Default `['top']` (the tab bar owns the bottom); full-screen and modal flows pass `['top', 'bottom']`. */
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
  savedAt,
  floating,
  edges = ['top'],
  className,
  contentClassName,
}: ScreenProps) {
  const online = useOnline();
  return (
    <View
      className={cn(
        'bg-background flex-1',
        edges.includes('top') && 'pt-safe',
        edges.includes('bottom') && 'pb-safe',
        className,
      )}>
      {banner ?? (
        <OfflineBanner
          visible={!online}
          message={savedAt ? `Showing saved data from ${savedAt}` : 'You are offline'}
        />
      )}
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
      {floating}
    </View>
  );
}
