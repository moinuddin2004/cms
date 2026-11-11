import { BottomSheetBackdrop, type BottomSheetBackdropProps, type BottomSheetBackgroundProps, type BottomSheetModal } from '@gorhom/bottom-sheet';
import { useEffect, useRef, type RefObject } from 'react';
import { BackHandler, View } from 'react-native';
import Animated from 'react-native-reanimated';

/** Card-coloured sheet surface (tokens via className; the library animates `style`). */
export function SheetBackground({ style }: BottomSheetBackgroundProps) {
  return <Animated.View pointerEvents="none" style={style} className="bg-card rounded-t-2xl" />;
}

/** Drag handle. */
export function SheetHandle() {
  return (
    <View className="items-center py-3">
      <View className="bg-border h-1.5 w-10 rounded-full" />
    </View>
  );
}

/** Dimmed backdrop. `pressToClose` false lets the owner intercept the tap (dirty guard). */
export function makeBackdrop(onPress?: () => void) {
  return function SheetBackdrop(props: BottomSheetBackdropProps) {
    return (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="none"
        onPress={onPress}
      />
    );
  };
}

/**
 * Drives a controlled `BottomSheetModal` from an `open` flag.
 *
 * - `open` true → `present()`, false → `dismiss()`.
 * - A dismissal the parent did not ask for (pan down) calls `onUserDismiss`.
 * - Android back while open calls `onBack` and swallows the press.
 *
 * Returns the ref to hand to the modal and the `onDismiss` handler.
 */
export function useControlledSheet(args: {
  open: boolean;
  onUserDismiss: () => void;
  onBack: () => void;
}): { ref: RefObject<BottomSheetModal | null>; onDismiss: () => void } {
  const { open, onUserDismiss, onBack } = args;
  const ref = useRef<BottomSheetModal | null>(null);
  const openRef = useRef(open);

  // Declared before the effect below so the ref is current when `dismiss()` triggers `onDismiss`.
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [open, onBack]);

  return {
    ref,
    onDismiss: () => {
      if (openRef.current) onUserDismiss();
    },
  };
}
