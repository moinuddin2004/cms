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

import { setupQueryManagers } from '@/core/query/managers';
import { staffQueryClient } from '@/staff/lib/query-client';

/**
 * Every global provider, in one place. Order matters: gestures → safe area →
 * keyboard → data → UI.
 *
 * `QueryClientProvider` stays here for now; it moves into the staff layout in
 * M0-04 so each space mounts its own cache.
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
            <QueryClientProvider client={staffQueryClient}>
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
