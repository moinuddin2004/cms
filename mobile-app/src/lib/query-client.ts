import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { AppState, Platform, type AppStateStatus } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
    },
    mutations: {
      // Never re-send a write on its own: a 4xx fails the same way again, and
      // re-sending a POST after a dropped response can create a duplicate.
      retry: false,
    },
  },
});

/** Wire React Query to the phone: network state and app foreground/background. */
export function setupQueryManagers(): () => void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  );

  const onAppState = (status: AppStateStatus) => {
    if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
  };
  const sub = AppState.addEventListener('change', onAppState);
  return () => sub.remove();
}
