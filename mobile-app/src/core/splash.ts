import * as SplashScreen from 'expo-splash-screen';

/**
 * The native splash stays up until the active space has decided where the user
 * goes (docs/02 §4: "the splash (root) or a skeleton covers it"). Each space
 * layout calls `markReady()` as soon as its session restore is no longer
 * `restoring`; the welcome picker calls it on mount. Called once is enough.
 *
 * Called in global scope, as the Expo SDK 58 docs require, so it runs before
 * the first frame.
 */
SplashScreen.preventAutoHideAsync();

let hidden = false;

/** Hide the splash screen. Safe to call from any space, any number of times. */
export function markReady(): void {
  if (hidden) return;
  hidden = true;
  SplashScreen.hide();
}
