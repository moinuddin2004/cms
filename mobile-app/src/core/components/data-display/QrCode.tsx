import { useState } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

export interface QrCodeProps {
  /** The text to encode. For a claim it is a bearer secret: never log it. */
  value: string;
  /** Pixel size of the QR square. */
  size?: number;
  /** Screen-reader description (never the value). */
  accessibilityLabel: string;
  className?: string;
}

/**
 * A real QR code (react-native-qrcode-svg). Always dark-on-white with a quiet
 * zone — scanners need that contrast whatever the app theme is, so these two
 * colours are deliberately not theme tokens. If the value cannot be encoded the
 * text itself is shown instead, so the flow never dead-ends.
 */
export function QrCode({ value, size = 220, accessibilityLabel, className }: QrCodeProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View
        accessible
        accessibilityLabel={accessibilityLabel}
        style={{ width: size, minHeight: size }}
        className={cn('bg-muted items-center justify-center rounded-lg p-3', className)}>
        <Text className="text-center font-mono text-xs">{value}</Text>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      className={cn('items-center justify-center rounded-lg bg-white p-3', className)}>
      <QRCode
        value={value}
        size={size}
        color="black"
        backgroundColor="white"
        ecl="M"
        onError={() => setFailed(true)}
      />
    </View>
  );
}
