import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaListener, SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from 'sonner-native';
import { Uniwind } from 'uniwind';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PortalHost } from '@rn-primitives/portal';

import { setupQueryManagers } from '@/core/query/managers';

/**
 * Every global provider, in one place. Order matters: gestures → safe area →
 * keyboard → theme → UI.
 *
 * There is no `QueryClientProvider` here on purpose (docs/02 §2): each space
 * mounts its own cache inside its own layout, so an inactive space runs no
 * queries. The staff layout owns `staffQueryClient`.
 */
export function RootProviders({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();

  useEffect(() => setupQueryManagers(), []);

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        {/* Feeds the safe-area insets to Uniwind's `pt-safe` / `pb-safe` classes. */}
        <SafeAreaListener onChange={({ insets }) => Uniwind.updateInsets(insets)}>
          <KeyboardProvider>
            <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
              {/* Hosts FormSheet / ActionSheet (core overlays). */}
              <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
              <Toaster />
              {/* Must be last: Dialog / Popover / Select render into this. */}
              <PortalHost />
            </ThemeProvider>
          </KeyboardProvider>
        </SafeAreaListener>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
