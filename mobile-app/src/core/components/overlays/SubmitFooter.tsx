import { BottomSheetFooter, type BottomSheetFooterProps } from '@gorhom/bottom-sheet';
import { useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { Spinner } from '@/core/components/layout/Spinner';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';

export interface SubmitSpec {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
}

export interface FooterState {
  submit?: SubmitSpec;
  onHeight: (height: number) => void;
}

/**
 * Tiny per-sheet store. gorhom renders the footer outside the sheet's React
 * context (portal), and a footer component created per render would remount, so
 * the footer is created once and reads the latest `submit` from here.
 */
export function createFooterStore() {
  let state: FooterState | undefined;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: FooterState) {
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
export type FooterStore = ReturnType<typeof createFooterStore>;

export function SubmitFooter({
  store,
  ...footerProps
}: BottomSheetFooterProps & { store: FooterStore }) {
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const submit = state?.submit;
  if (!submit) return null;
  const blocked = !!(submit.disabled || submit.pending);
  return (
    <BottomSheetFooter {...footerProps}>
      <View
        onLayout={(e) => state?.onHeight(e.nativeEvent.layout.height)}
        className="bg-card border-border border-t px-4 pt-3 pb-safe">
        <Button
          className="min-h-12"
          disabled={blocked}
          accessibilityState={{ busy: !!submit.pending, disabled: blocked }}
          onPress={submit.onPress}>
          {submit.pending ? <Spinner tone="primary-foreground" /> : null}
          <Text>{submit.label}</Text>
        </Button>
      </View>
    </BottomSheetFooter>
  );
}
