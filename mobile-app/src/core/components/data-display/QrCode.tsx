import { View } from 'react-native';

import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

export interface QrCodeProps {
  /** The text to encode. For a claim it is a bearer secret: never log it. */
  value: string;
  /** Pixel size of the square. */
  size?: number;
  /** Screen-reader description (never the value). */
  accessibilityLabel: string;
  className?: string;
}

/**
 * A QR code. No QR library is installed yet (`react-native-svg` is, but it only
 * draws): until `react-native-qrcode-svg` is added (see the M2-15 HANDOFF for the
 * exact command) the code is shown as selectable text so the flow stays usable.
 * Swap the body below for `<QRCode value={value} size={size} />` after the install;
 * callers and props do not change.
 */
export function QrCode({ value, size = 220, accessibilityLabel, className }: QrCodeProps) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, minHeight: size }}
      className={cn('bg-muted items-center justify-center rounded-lg p-3', className)}>
      <Text className="text-center font-mono text-xs">
        {value}
      </Text>
    </View>
  );
}
