import { act, render, screen, userEvent } from '@testing-library/react-native';

import type { PushData } from '@/core/notifications/push-data';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { handleStaffNotificationRoute } from '../lib/handle-staff-notification-route';
import { usePushRouteStore } from '../store/usePushRouteStore';
import { PushRoutePrompt } from './PushRoutePrompt';

const mockNavigate = jest.fn();
const mockMutateAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));
jest.mock('@/staff/features/more/hooks/useSwitchLocation', () => ({
  useSwitchLocation: () => ({ mutateAsync: mockMutateAsync }),
}));
jest.mock('@/staff/lib/session', () => ({ getRefreshToken: jest.fn() }));
jest.mock('@/core/components', () => {
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    ConfirmDialog: ({
      open,
      title,
      confirmLabel,
      onConfirm,
      onClose,
    }: {
      open: boolean;
      title: string;
      confirmLabel: string;
      onConfirm: () => void | Promise<void>;
      onClose: () => void;
    }) =>
      open ? (
        <View>
          <Text>{title}</Text>
          <Pressable onPress={() => void onConfirm()}>
            <Text>{confirmLabel}</Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text>cancel</Text>
          </Pressable>
        </View>
      ) : null,
  };
});

const orgs = [
  {
    id: 'o1',
    name: 'Smile',
    locations: [
      { id: 'l1', name: 'Main' },
      { id: 'l2', name: 'North' },
    ],
  },
] as never;

const push = (over: Partial<PushData> = {}): PushData => ({
  space: 'staff',
  type: 'queue.checked_in',
  route: '/queue/doctor',
  organizationId: 'o1',
  locationId: 'l1',
  entityId: null,
  ...over,
});

function signIn() {
  useStaffAuthStore.setState({
    status: 'signedIn',
    accessibleOrganizations: orgs,
    activeOrganizationId: 'o1',
    activeLocationId: 'l1',
  });
}

describe('PushRoutePrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePushRouteStore.setState({ pending: null, ask: null });
    signIn();
  });

  it('warm tap in the active location: navigates to the Queue doctor segment', async () => {
    await render(<PushRoutePrompt />);
    await act(async () => handleStaffNotificationRoute(push()));
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/queue', params: { segment: 'doctor' } });
    expect(usePushRouteStore.getState().pending).toBeNull();
  });

  it('cold start: a tap parked before the session is restored fires once it is', async () => {
    useStaffAuthStore.setState({ status: 'restoring' });
    handleStaffNotificationRoute(push({ route: null }));
    await render(<PushRoutePrompt />);
    expect(mockNavigate).not.toHaveBeenCalled();

    await act(async () => signIn());
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/today' });
  });

  it('another location: asks first, switches, then navigates', async () => {
    await render(<PushRoutePrompt />);
    await act(async () => handleStaffNotificationRoute(push({ locationId: 'l2' })));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(await screen.findByText('Switch to Smile – North?')).toBeTruthy();

    const user = userEvent.setup();
    await user.press(screen.getByText('Switch'));
    expect(mockMutateAsync).toHaveBeenCalledWith({ organizationId: 'o1', locationId: 'l2' });
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/queue', params: { segment: 'doctor' } });
  });

  it('cancel keeps the user where they are', async () => {
    await render(<PushRoutePrompt />);
    await act(async () => handleStaffNotificationRoute(push({ locationId: 'l2' })));
    const user = userEvent.setup();
    await user.press(await screen.findByText('cancel'));
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByText('Switch to Smile – North?')).toBeNull();
  });

  it('drops a stale tap', async () => {
    useStaffAuthStore.setState({ status: 'restoring' });
    usePushRouteStore.getState().setPending(push(), Date.now() - 3 * 60_000);
    await render(<PushRoutePrompt />);
    expect(usePushRouteStore.getState().pending).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
