import {
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';

import { IconButton } from '@/core/components/layout/IconButton';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';

import { ConfirmDialog } from './ConfirmDialog';
import { makeBackdrop, SheetBackground, SheetHandle, useControlledSheet } from './sheet-parts';

export interface FormSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Form fields. Use `FieldWrapper` + `FormInput`; `BottomSheetTextInput` is not needed. */
  children: ReactNode;
  /** Unsaved changes: closing (X, back, backdrop) asks first; pan-down is disabled. */
  isDirty?: boolean;
  /** Strings for the "Discard changes?" confirmation (core never translates). */
  discard: { title: string; description: string; confirmLabel: string; cancelLabel: string };
  /** Accessibility label of the close (X) button. */
  closeLabel: string;
  /** Sticky submit button. Pass `disabled = !canSubmit`, `pending = isSubmitting`. */
  submit?: { label: string; onPress: () => void; disabled?: boolean; pending?: boolean };
  /** Server error banner at the top of the sheet. */
  error?: string;
}

/**
 * Bottom sheet that hosts a form (docs/05 §7). Dynamic height up to 90 % of the
 * screen, keyboard-interactive with the library's `interactive` behaviour and
 * `adjustResize` on Android, sticky submit footer, dirty guard via `ConfirmDialog`.
 * Needs `BottomSheetModalProvider` (mounted in `RootProviders`).
 */
export function FormSheet({
  open,
  onClose,
  title,
  children,
  isDirty = false,
  discard,
  closeLabel,
  submit,
  error,
}: FormSheetProps) {
  const { height } = useWindowDimensions();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);

  const requestClose = () => (isDirty ? setConfirmOpen(true) : onClose());
  const { ref, onDismiss } = useControlledSheet({
    open,
    onUserDismiss: requestClose,
    onBack: requestClose,
  });

  const Footer = submit
    ? (props: BottomSheetFooterProps) => (
        <BottomSheetFooter {...props}>
          <View
            onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
            className="bg-card border-border border-t px-4 pt-3 pb-safe">
            <Button
              className="min-h-12"
              disabled={submit.disabled || submit.pending}
              accessibilityState={{ busy: !!submit.pending, disabled: !!submit.disabled }}
              onPress={submit.onPress}>
              {submit.pending ? <ActivityIndicator size="small" /> : null}
              <Text>{submit.label}</Text>
            </Button>
          </View>
        </BottomSheetFooter>
      )
    : undefined;

  return (
    <>
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        maxDynamicContentSize={height * 0.9}
        enablePanDownToClose={!isDirty}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={makeBackdrop(requestClose)}
        backgroundComponent={SheetBackground}
        handleComponent={SheetHandle}
        footerComponent={Footer}
        onDismiss={onDismiss}>
        <View className="flex-row items-center justify-between gap-2 ps-4 pe-2">
          <Text variant="h3" className="flex-1 text-start">
            {title}
          </Text>
          <IconButton icon={X} accessibilityLabel={closeLabel} onPress={requestClose} />
        </View>
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-4 p-4"
          // The sticky footer floats over the scroll area: keep the last field above it.
          contentContainerStyle={{ paddingBottom: 16 + footerHeight }}>
          {error ? (
            <View accessibilityRole="alert" className="bg-destructive/10 rounded-md p-3">
              <Text className="text-destructive text-sm font-medium">{error}</Text>
            </View>
          ) : null}
          {children}
        </BottomSheetScrollView>
      </BottomSheetModal>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={discard.title}
        description={discard.description}
        confirmLabel={discard.confirmLabel}
        cancelLabel={discard.cancelLabel}
        destructive
        onConfirm={() => {
          setConfirmOpen(false);
          onClose();
        }}
      />
    </>
  );
}
