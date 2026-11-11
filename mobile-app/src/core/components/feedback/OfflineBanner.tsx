import { WifiOff } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

export interface OfflineBannerProps {
  /** Whole sentence, e.g. "Offline — showing saved data from 10:42". */
  message: string;
  /** Pass `!online`; renders nothing when false so `Screen`'s banner slot stays empty. */
  visible?: boolean;
}

/** Thin banner at the top of a screen while the phone is offline. */
export function OfflineBanner({ message, visible = true }: OfflineBannerProps) {
  if (!visible) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="bg-warning flex-row items-center gap-2 px-4 py-2">
      <Icon as={WifiOff} className="text-warning-foreground size-4" />
      <Text className="text-warning-foreground flex-1 text-sm font-medium">{message}</Text>
    </View>
  );
}
