import NetInfo from '@react-native-community/netinfo';
import { act, renderHook } from '@testing-library/react-native';
import { useCanMutate } from '@/core/http/use-can-mutate';
import { isOnlineNow, useOnline } from './use-online';

type Listener = (s: { isConnected: boolean | null }) => void;

function captureListener() {
  let listener: Listener = () => {};
  (NetInfo.addEventListener as jest.Mock).mockImplementationOnce((l: Listener) => {
    listener = l;
    return jest.fn();
  });
  return (s: { isConnected: boolean | null }) => listener(s);
}

describe('useOnline', () => {
  it('follows NetInfo and treats unknown as online', async () => {
    const emit = captureListener();
    const { result } = await renderHook(() => useOnline());

    await act(async () => emit({ isConnected: false }));
    expect(result.current).toBe(false);
    expect(isOnlineNow()).toBe(false);

    await act(async () => emit({ isConnected: null }));
    expect(result.current).toBe(true);
    expect(isOnlineNow()).toBe(true);
  });

  it('useCanMutate is false while offline', async () => {
    const emit = captureListener();
    const { result } = await renderHook(() => useCanMutate());

    await act(async () => emit({ isConnected: false }));
    expect(result.current).toBe(false);
  });
});
