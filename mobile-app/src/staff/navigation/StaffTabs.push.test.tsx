import { act, render } from '@testing-library/react-native';

import type { PushData } from '@/core/notifications/push-data';
import { handleStaffNotificationRoute } from '@/staff/features/devices';
import { usePushRouteStore } from '@/staff/features/devices/store/usePushRouteStore';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';
import { PushRoutePrompt } from '@/staff/features/devices/components/PushRoutePrompt';

import { StaffTabs } from './StaffTabs';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
let mockAccessStatus: 'loading' | 'ready' = 'loading';

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate, replace: mockReplace }),
}));
jest.mock('expo-router/js-tabs', () => {
  function Tabs({ children }: { children?: React.ReactNode }) {
    return children ?? null;
  }
  Tabs.Screen = function Screen() {
    return null;
  };
  return { Tabs };
});
jest.mock('uniwind', () => ({ useCSSVariable: () => undefined }));
jest.mock('@/staff/features/access', () => ({
  useAccess: () => ({ status: mockAccessStatus, can: () => true }),
  AccessErrorBanner: () => null,
}));
jest.mock('@/staff/features/more', () => ({
  useSwitchLocation: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('@/staff/lib/session', () => ({ getRefreshToken: jest.fn() }));
jest.mock('@/core/components', () => ({ ConfirmDialog: () => null }));

const push = (over: Partial<PushData> = {}): PushData => ({
  space: 'staff',
  type: 'queue.checked_in',
  route: '/queue/doctor',
  organizationId: 'o1',
  locationId: 'l1',
  entityId: null,
  ...over,
});

function mountBoth() {
  return render(
    <>
      <PushRoutePrompt />
      <StaffTabs />
    </>,
  );
}

describe('cold-start push tap + StaffTabs first-tab placement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessStatus = 'loading';
    usePushRouteStore.setState({ pending: null, ask: null, handled: false });
    useStaffAuthStore.setState({
      status: 'signedIn',
      accessibleOrganizations: [
        { id: 'o1', name: 'Smile', locations: [{ id: 'l1', name: 'Main' }] },
      ] as never,
      activeOrganizationId: 'o1',
      activeLocationId: 'l1',
    });
  });

  it('the tapped screen wins: the tabs do not jump to the first tab over it', async () => {
    handleStaffNotificationRoute(push());
    const view = await mountBoth();
    expect(mockNavigate).not.toHaveBeenCalled(); // access not ready: wait

    mockAccessStatus = 'ready';
    await act(async () => view.rerender(<><PushRoutePrompt /><StaffTabs /></>));

    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/queue', params: { segment: 'doctor' } });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('without a tap the tabs still open on the first allowed tab', async () => {
    const view = await mountBoth();
    mockAccessStatus = 'ready';
    await act(async () => view.rerender(<><PushRoutePrompt /><StaffTabs /></>));
    expect(mockReplace).toHaveBeenCalledWith('/queue');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
