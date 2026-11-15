import { fireEvent, render, screen } from '@testing-library/react-native';

import { NotificationBellButton } from './NotificationBell';

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => true,
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    cancelAnimation: () => {},
  };
});

// The bottom-sheet runtime needs native gestures; the sheets are not under test here.
jest.mock('@gorhom/bottom-sheet', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    BottomSheetModal: React.forwardRef(function MockModal(
      { children }: { children?: React.ReactNode },
      _ref,
    ) {
      return <>{children}</>;
    }),
    BottomSheetScrollView: Pass,
    BottomSheetView: Pass,
    BottomSheetFooter: Pass,
    BottomSheetBackdrop: Pass,
    BottomSheetTextInput: (props: object) => <RN.TextInput {...props} />,
  };
});
jest.mock('@/core/components/overlays/sheet-parts', () => ({
  SheetBackground: () => null,
  SheetHandle: () => null,
  useSheetBackdrop: () => undefined,
  useControlledSheet: () => ({ ref: { current: null }, onDismiss: () => {} }),
}));

jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../hooks/useNotifications', () => ({ useUnreadCount: () => ({ data: 0 }) }));

describe('NotificationBellButton', () => {
  it('hides the badge at 0', async () => {
    await render(<NotificationBellButton count={0} onPress={jest.fn()} />);
    expect(screen.getByLabelText('Notifications')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('shows the count and puts it in the label', async () => {
    await render(<NotificationBellButton count={7} onPress={jest.fn()} />);
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByLabelText('Notifications, 7 unread')).toBeTruthy();
  });

  it('caps at 99+', async () => {
    await render(<NotificationBellButton count={250} onPress={jest.fn()} />);
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<NotificationBellButton count={1} onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Notifications, 1 unread'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
