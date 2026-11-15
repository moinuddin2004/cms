import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import type { NotificationItem } from '../types/notifications.types';
import { NotificationsPage } from './NotificationsPage';

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View },
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

jest.mock('@shopify/flash-list', () => {
  const { FlatList } = jest.requireActual<typeof import('react-native')>('react-native');
  return { FlashList: (props: object) => <FlatList {...(props as { data: never[] })} /> };
});

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate, push: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));

const mockMarkRead = jest.fn();
const mockMarkAll = jest.fn();
const mockSwitch = jest.fn(async () => undefined);
let mockItems: NotificationItem[] = [];
jest.mock('../hooks/useNotifications', () => ({
  useNotificationsInfinite: () => ({
    isPending: false,
    isError: false,
    isRefetchError: false,
    isFetchNextPageError: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    data: { pages: [{ data: mockItems }] },
    refetch: jest.fn(() => Promise.resolve()),
    fetchNextPage: jest.fn(),
  }),
  useUnreadCount: () => ({ data: 2 }),
  useMarkRead: () => ({ mutate: mockMarkRead }),
  useMarkAllRead: () => ({ mutate: mockMarkAll, isPending: false }),
}));
jest.mock('@/staff/features/more/hooks/useSwitchLocation', () => ({
  useSwitchLocation: () => ({ mutateAsync: mockSwitch, isPending: false }),
}));
jest.mock('sonner-native', () => ({ toast: { error: jest.fn() } }));

// Stand-in for the real dialog: shows title + confirm only while open.
jest.mock('@/core/components/overlays/ConfirmDialog', () => {
  const { Pressable: P, Text: T, View: V } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ConfirmDialog: ({
      open,
      title,
      confirmLabel,
      onConfirm,
    }: {
      open: boolean;
      title: string;
      confirmLabel: string;
      onConfirm: () => void;
    }): ReactNode =>
      open ? (
        <V>
          <T>{title}</T>
          <P accessibilityRole="button" accessibilityLabel="dialog-confirm" onPress={onConfirm}>
            <T>{confirmLabel}</T>
          </P>
        </V>
      ) : null,
  };
});

const PATIENT = '3f2b8c1e-9d4a-4e6b-8a7c-1b2d3e4f5a6b';
const item = (over: Partial<NotificationItem>): NotificationItem => ({
  id: 'n1',
  organizationId: 'o1',
  eventCode: 'x',
  title: 'Title',
  body: 'Body',
  link: null,
  readAt: null,
  createdAt: '2026-11-14T10:00:00.000Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  useStaffAuthStore.setState({
    activeOrganizationId: 'o1',
    activeLocationId: 'l1',
    accessibleOrganizations: [
      { id: 'o1', name: 'Alpha', locations: [{ id: 'l1', name: 'Main' }] },
      { id: 'o2', name: 'Beta Dental', locations: [{ id: 'l2', name: 'City' }] },
    ] as never,
  });
});

describe('NotificationsPage', () => {
  it('marks read and navigates for an active-clinic row', async () => {
    mockItems = [item({ title: 'Walk-in', link: `/patients/${PATIENT}` })];
    await render(<NotificationsPage />);
    await fireEvent.press(screen.getByText('Walk-in'));
    expect(mockMarkRead).toHaveBeenCalledWith('n1');
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: `/patients/${PATIENT}` });
  });

  it('stays put on an unknown link but still marks read', async () => {
    mockItems = [item({ title: 'Odd', link: '/lab-orders/7' })];
    await render(<NotificationsPage />);
    await fireEvent.press(screen.getByText('Odd'));
    expect(mockMarkRead).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('asks before switching for another clinic, then navigates after confirm', async () => {
    mockItems = [item({ title: 'Other', organizationId: 'o2', link: '/queue/doctor' })];
    await render(<NotificationsPage />);
    expect(screen.getByText('Beta Dental')).toBeTruthy();

    await fireEvent.press(screen.getByText('Other'));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByText('Switch to Beta Dental?')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('dialog-confirm'));
    expect(mockSwitch).toHaveBeenCalledWith({ organizationId: 'o2', locationId: 'l2' });
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/queue', params: { segment: 'doctor' } });
  });

  it('marks all read from the header', async () => {
    mockItems = [item({})];
    await render(<NotificationsPage />);
    await fireEvent.press(screen.getByLabelText('Mark all as read'));
    expect(mockMarkAll).toHaveBeenCalled();
  });
});
