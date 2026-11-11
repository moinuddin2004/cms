import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

import { makeBackdrop, SheetBackground, SheetHandle, useControlledSheet } from './sheet-parts';

export interface SheetAction {
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  onPress: () => void;
}

export interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  actions: SheetAction[];
  cancelLabel: string;
}

/** List of actions for a row (long-press or "…"). Destructive ones should then ask via `ConfirmDialog`. */
export function ActionSheet({ open, onClose, title, actions, cancelLabel }: ActionSheetProps) {
  const { ref, onDismiss } = useControlledSheet({ open, onUserDismiss: onClose, onBack: onClose });

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={makeBackdrop(onClose)}
      backgroundComponent={SheetBackground}
      handleComponent={SheetHandle}
      onDismiss={onDismiss}>
      <BottomSheetView className="pb-safe">
        {title ? (
          <Text variant="muted" className="px-4 pb-2" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            onPress={() => {
              onClose();
              action.onPress();
            }}
            className="active:bg-accent min-h-12 flex-row items-center gap-3 px-4 py-3">
            {action.icon ? (
              <Icon
                as={action.icon}
                className={cn(action.destructive ? 'text-destructive' : 'text-foreground')}
              />
            ) : (
              <View className="size-5" />
            )}
            <Text className={cn('text-base', action.destructive && 'text-destructive')}>
              {action.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          className="active:bg-accent min-h-12 items-center justify-center px-4 py-3">
          <Text className="text-muted-foreground font-medium">{cancelLabel}</Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
