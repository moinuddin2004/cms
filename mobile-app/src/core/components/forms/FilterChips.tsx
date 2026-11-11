import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

export interface FilterChipOption {
  value: string;
  label: string;
}

export interface FilterChipsProps {
  options: FilterChipOption[];
  /** Selected option values. */
  value: string[];
  onChange: (value: string[]) => void;
  /** `true` = any number selected; default = at most one (tapping it again clears). */
  multiple?: boolean;
  /** When set, a trailing "Clear" chip with the active count shows while any chip is active. */
  clearLabel?: string;
}

/** Horizontal single/multi-select chips with an active count (docs/05 §7 lists). */
export function FilterChips({ options, value, onChange, multiple = false, clearLabel }: FilterChipsProps) {
  const toggle = (optionValue: string) => {
    const selected = value.includes(optionValue);
    if (multiple) {
      onChange(selected ? value.filter((v) => v !== optionValue) : [...value, optionValue]);
    } else {
      onChange(selected ? [] : [optionValue]);
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-2 px-4">
      {options.map((option) => {
        const selected = value.includes(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => toggle(option.value)}
            className={cn(
              'min-h-11 items-center justify-center rounded-full border px-4',
              selected ? 'border-primary bg-primary' : 'border-border bg-card active:bg-accent',
            )}>
            <Text
              className={cn('text-sm font-medium', selected && 'text-primary-foreground')}
              numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
      {clearLabel && value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${clearLabel} (${value.length})`}
          onPress={() => onChange([])}
          className="border-border min-h-11 flex-row items-center justify-center gap-2 rounded-full border px-4 active:bg-accent">
          <Text className="text-sm font-medium">{clearLabel}</Text>
          <View className="bg-foreground size-5 items-center justify-center rounded-full">
            <Text className="text-background text-xs font-semibold">{value.length}</Text>
          </View>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
