import { focusManager, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { AppState, Platform, type AppStateStatus } from 'react-native';

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
