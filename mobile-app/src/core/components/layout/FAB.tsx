import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

export interface FABProps {
  icon: LucideIcon;
  /** Spoken label; also shown next to the icon when `extended`. */
  label: string;
  onPress: () => void;
  extended?: boolean;
  disabled?: boolean;
  /** Override the default position (`end-4 bottom-4`), e.g. to clear a tab bar. */
  className?: string;
}

/** Floating primary action. Only where a screen spec in docs/06 asks for one. */
export function FAB({ icon, label, onPress, extended = false, disabled, className }: FABProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'bg-primary active:bg-primary/90 absolute bottom-4 end-4 min-h-14 min-w-14 flex-row items-center justify-center gap-2 rounded-full shadow-sm',
        extended && 'px-5',
        disabled && 'opacity-50',
        className,
      )}>
      <Icon as={icon} className="text-primary-foreground size-6" />
      {extended ? <Text className="text-primary-foreground font-medium">{label}</Text> : null}
    </Pressable>
  );
}
