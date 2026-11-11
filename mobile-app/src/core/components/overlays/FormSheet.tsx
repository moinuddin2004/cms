import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { X } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { IconButton } from '@/core/components/layout/IconButton';
import { Text } from '@/core/ui/text';

import { ConfirmDialog } from './ConfirmDialog';
import { SheetInputContext } from './sheet-input-context';
import { SheetBackground, SheetHandle, useControlledSheet, useSheetBackdrop } from './sheet-parts';
import { createFooterStore, SubmitFooter, type SubmitSpec } from './SubmitFooter';

export interface FormSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Form fields. Use `FieldWrapper` + `FormInput` (it renders `BottomSheetTextInput` inside a sheet). */
  children: ReactNode;
  /** Unsaved changes: closing (X, back, backdrop) asks first; pan-down is disabled. */
  isDirty?: boolean;
  /** Strings for the "Discard changes?" confirmation (core never translates). */
  discard: { title: string; description: string; confirmLabel: string; cancelLabel: string };
  /** Accessibility label of the close (X) button. */
  closeLabel: string;
  /** Sticky submit button. Pass `disabled = !canSubmit`, `pending = isSubmitting`. */
  submit?: SubmitSpec;
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

  // The footer is created once per sheet and reads the latest `submit` from the store,
  // so it never remounts (see SubmitFooter).
  const [store] = useState(createFooterStore);
  const [Footer] = useState(
    () =>
      function FormSheetFooter(props: Omit<Parameters<typeof SubmitFooter>[0], 'store'>) {
        return <SubmitFooter {...props} store={store} />;
      },
  );
  useEffect(() => {
    store.set({ submit, onHeight: setFooterHeight });
  }, [store, submit]);

  const requestClose = () => (isDirty ? setConfirmOpen(true) : onClose());
  const { ref, onDismiss } = useControlledSheet({
    open,
    // The sheet is already gone (programmatic dismissal): tell the parent, don't ask.
    onUserDismiss: onClose,
    // Back closes an open confirmation first.
    onBack: confirmOpen ? () => setConfirmOpen(false) : requestClose,
  });
  const backdrop = useSheetBackdrop(requestClose);

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
        backdropComponent={backdrop}
        backgroundComponent={SheetBackground}
        handleComponent={SheetHandle}
        footerComponent={Footer}
        onDismiss={onDismiss}>
        <SheetInputContext.Provider value>
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
            contentContainerStyle={{ paddingBottom: 16 + (submit ? footerHeight : 0) }}>
            {error ? (
              <View accessibilityRole="alert" className="bg-destructive/10 rounded-md p-3">
                <Text className="text-destructive text-sm font-medium">{error}</Text>
              </View>
            ) : null}
            {children}
          </BottomSheetScrollView>
        </SheetInputContext.Provider>
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
