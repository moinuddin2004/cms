import * as Haptics from 'expo-haptics';
import { Moon, Smartphone, Sun, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { ThemeMode } from '@/core/theme/apply-theme-mode';
import { useThemePreference } from '@/core/theme/theme-preference';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

export interface ThemeModePickerProps {
  /** Patient callers pass translated labels; staff keeps the English defaults (A-12). */
  labels?: Partial<Record<ThemeMode, string>>;
  /** Screen-reader name of the whole group. */
  accessibilityLabel?: string;
  className?: string;
}

const OPTIONS: { value: ThemeMode; icon: LucideIcon; fallback: string }[] = [
  { value: 'light', icon: Sun, fallback: 'Light' },
  { value: 'dark', icon: Moon, fallback: 'Dark' },
  { value: 'system', icon: Smartphone, fallback: 'System' },
];

/**
 * Light / Dark / System — the web app's theme switch on the phone. The choice
 * is the person's own and app-wide (`theme-preference.ts`); it beats the
 * clinic's default mode.
 */
export function ThemeModePicker({
  labels,
  accessibilityLabel = 'Appearance',
  className,
}: ThemeModePickerProps) {
  const selected = useThemePreference((s) => s.mode());
  const setPreference = useThemePreference((s) => s.setPreference);

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      className={cn('flex-row gap-2', className)}>
      {OPTIONS.map(({ value, icon, fallback }) => {
        const active = value === selected;
        const label = labels?.[value] ?? fallback;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ selected: active, checked: active }}
            onPress={() => {
              if (active) return;
              void Haptics.selectionAsync().catch(() => undefined);
              setPreference(value);
            }}
            className={cn(
              'min-h-20 flex-1 items-center justify-center gap-2 rounded-xl border-2 px-2 py-3',
              active ? 'border-primary bg-primary/10' : 'border-border bg-background active:bg-accent',
            )}>
            <View
              className={cn(
                'size-9 items-center justify-center rounded-full',
                active ? 'bg-primary' : 'bg-muted',
              )}>
              <Icon
                as={icon}
                className={cn('size-5', active ? 'text-primary-foreground' : 'text-muted-foreground')}
              />
            </View>
            <Text
              numberOfLines={1}
              className={cn('text-sm font-medium', active ? 'text-primary' : 'text-foreground')}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
