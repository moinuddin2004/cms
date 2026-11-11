import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

import type { ConnectionState } from './connection-state';

export interface ConnectionPillProps {
  state: ConnectionState;
  /** Text for each state, e.g. "Live" / "Reconnecting…" / "Offline" (core never translates). */
  labels: Record<ConnectionState, string>;
}

const DOT: Record<ConnectionState, string> = {
  live: 'bg-success',
  reconnecting: 'bg-warning',
  offline: 'bg-muted-foreground',
};

/** Live / Reconnecting / Offline indicator for realtime screens. Only "Reconnecting" pulses. */
export function ConnectionPill({ state, labels }: ConnectionPillProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (state === 'reconnecting' && !reduceMotion) {
      opacity.value = withRepeat(withTiming(0.3, { duration: 700 }), -1, true);
    } else {
      opacity.value = 1;
    }
  }, [state, reduceMotion, opacity]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      accessible
      accessibilityLabel={labels[state]}
      accessibilityLiveRegion="polite"
      className="bg-muted flex-row items-center gap-2 self-start rounded-full px-3 py-1.5">
      <Animated.View style={dotStyle} className={cn('size-2 rounded-full', DOT[state])} />
      <Text className="text-xs font-medium">{labels[state]}</Text>
    </View>
  );
}
