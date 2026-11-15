import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getPermissionState, requestPermission } from '@/core/notifications/permissions';
import { getPref, removePref } from '@/core/storage/prefs';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { registerThisDevice } from '../lib/device-registration';
import { usePushRegistration } from './usePushRegistration';

jest.mock('@/core/notifications/permissions', () => ({
  getPermissionState: jest.fn(),
  requestPermission: jest.fn(),
}));
jest.mock('../lib/device-registration', () => ({ registerThisDevice: jest.fn() }));

const state = getPermissionState as jest.Mock;
const request = requestPermission as jest.Mock;

describe('usePushRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    removePref('staff.push.asked');
    useStaffAuthStore.setState({ user: { uuid: 'u1' } as never });
  });

  it('granted: registers without any prompt or sheet', async () => {
    state.mockResolvedValue('granted');
    const { result } = await renderHook(() => usePushRegistration());
    await waitFor(() => expect(registerThisDevice).toHaveBeenCalledTimes(1));
    expect(result.current.sheetOpen).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('saved-data mode: waits, then registers when the session recovers', async () => {
    state.mockResolvedValue('granted');
    useStaffAuthStore.setState({ offlineSnapshot: true });
    await renderHook(() => usePushRegistration());
    await act(async () => {});
    expect(registerThisDevice).not.toHaveBeenCalled();
    await act(async () => {
      useStaffAuthStore.setState({ offlineSnapshot: false });
    });
    await waitFor(() => expect(registerThisDevice).toHaveBeenCalledTimes(1));
  });

  it('undetermined: shows our sheet, not the OS prompt, until the user agrees', async () => {
    state.mockResolvedValue('undetermined');
    const { result } = await renderHook(() => usePushRegistration());
    await waitFor(() => expect(result.current.sheetOpen).toBe(true));
    expect(request).not.toHaveBeenCalled();
    expect(registerThisDevice).not.toHaveBeenCalled();

    request.mockResolvedValue('granted');
    await act(async () => {
      await result.current.enable();
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(registerThisDevice).toHaveBeenCalledTimes(1);
    expect(result.current.sheetOpen).toBe(false);
    expect(getPref('staff.push.asked')).toBe('1');
  });

  it('enable then OS "deny": nothing is registered', async () => {
    state.mockResolvedValue('undetermined');
    const { result } = await renderHook(() => usePushRegistration());
    await waitFor(() => expect(result.current.sheetOpen).toBe(true));
    request.mockResolvedValue('denied');
    await act(async () => {
      await result.current.enable();
    });
    expect(registerThisDevice).not.toHaveBeenCalled();
  });

  it('"Not now" closes the sheet and it never reopens', async () => {
    state.mockResolvedValue('undetermined');
    const first = await renderHook(() => usePushRegistration());
    await waitFor(() => expect(first.result.current.sheetOpen).toBe(true));
    await act(async () => first.result.current.dismiss());
    expect(first.result.current.sheetOpen).toBe(false);
    await first.unmount();

    const second = await renderHook(() => usePushRegistration());
    await act(async () => undefined);
    expect(second.result.current.sheetOpen).toBe(false);
  });

  it('denied: stays quiet', async () => {
    state.mockResolvedValue('denied');
    const { result } = await renderHook(() => usePushRegistration());
    await act(async () => undefined);
    expect(result.current.sheetOpen).toBe(false);
    expect(registerThisDevice).not.toHaveBeenCalled();
  });
});
