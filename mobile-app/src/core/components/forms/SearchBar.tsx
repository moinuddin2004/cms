import { Search, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/core/ui/icon';
import { Input } from '@/core/ui/input';
import { IconButton } from '@/core/components/layout/IconButton';

export interface SearchBarProps {
  /** The committed (already debounced) value held by the screen. */
  value: string;
  /** Called 300 ms after the last keystroke, or at once when cleared. */
  onChange: (value: string) => void;
  placeholder: string;
  /** Accessibility label of the clear button. Staff default; patient callers must pass a translated string. */
  clearLabel?: string;
  debounceMs?: number;
}

/** Debounced search field with a clear button. */
export function SearchBar({
  value,
  onChange,
  placeholder,
  clearLabel = 'Clear search',
  debounceMs = 300,
}: SearchBarProps) {
  const [text, setText] = useState(value);
  // Last value this bar reported (or was given); lets us tell a screen-side reset
  // from the echo of our own debounced onChange, which must not overwrite typing.
  const [emitted, setEmitted] = useState(value);
  const [seenValue, setSeenValue] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The screen may reset the value (e.g. "Clear all filters"): follow it.
  if (value !== seenValue) {
    setSeenValue(value);
    if (value !== emitted) {
      setText(value);
      setEmitted(value);
    }
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const emit = (next: string) => {
    setEmitted(next);
    onChange(next);
  };

  const handleChange = (next: string) => {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => emit(next), debounceMs);
  };

  const handleClear = () => {
    if (timer.current) clearTimeout(timer.current);
    setText('');
    emit('');
  };

  return (
    <View className="justify-center">
      <View pointerEvents="none" className="absolute start-3 z-10">
        <Icon as={Search} className="text-muted-foreground size-5" />
      </View>
      <Input
        value={text}
        onChangeText={handleChange}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        className="h-11 ps-10 pe-11"
      />
      {text.length > 0 ? (
        <View className="absolute end-0">
          <IconButton icon={X} accessibilityLabel={clearLabel} onPress={handleClear} />
        </View>
      ) : null}
    </View>
  );
}
