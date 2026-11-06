import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaListener, SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from 'sonner-native';
import { Uniwind } from 'uniwind';
import { PortalHost } from '@rn-primitives/portal';

import { queryClient, setupQueryManagers } from '@/lib/query-client';

/** Every global provider, in one place. Order matters: gestures → safe area → keyboard → data → UI. */
export function AppProviders({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();

  useEffect(() => setupQueryManagers(), []);

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        {/* Feeds the safe-area insets to Uniwind's `pt-safe` / `pb-safe` classes. */}
        <SafeAreaListener onChange={({ insets }) => Uniwind.updateInsets(insets)}>
          <KeyboardProvider>
            <QueryClientProvider client={queryClient}>
              <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
                {children}
                <Toaster />
                {/* Must be last: Dialog / Popover / Select render into this. */}
                <PortalHost />
              </ThemeProvider>
            </QueryClientProvider>
          </KeyboardProvider>
        </SafeAreaListener>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
