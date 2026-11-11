import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * App config (card M0-07, docs/02 §11).
 *
 * `APP_VARIANT` selects the build variant. EAS sets it from the matching
 * profile in `eas.json`; a plain `npx expo start` / `expo run:android` is the
 * development variant. Each variant needs its own package/bundle id so a
 * development build can be installed next to a preview build (Expo docs:
 * "Install app variants on the same device").
 *
 * The package name is the placeholder agreed for now — decision O-01 (final
 * app identity) is still open, so do not use a real domain here.
 */
const VARIANTS = {
  development: {
    name: 'Clinic (Dev)',
    idSuffix: '.dev',
    scheme: 'clinicapp-dev',
  },
  preview: {
    name: 'Clinic (Preview)',
    idSuffix: '.preview',
    scheme: 'clinicapp-preview',
  },
  production: {
    name: 'Clinic',
    idSuffix: '',
    scheme: 'clinicapp',
  },
} as const;

type AppVariant = keyof typeof VARIANTS;

function resolveVariant(): AppVariant {
  const raw = process.env.APP_VARIANT?.trim() || 'development';
  if (!Object.hasOwn(VARIANTS, raw)) {
    throw new Error(
      `Unknown APP_VARIANT "${raw}". Use development, preview or production (see eas.json).`,
    );
  }
  return raw as AppVariant;
}

const variant = VARIANTS[resolveVariant()];
const applicationId = `com.placeholder.clinicapp${variant.idSuffix}`;

/**
 * Filled by the user after `eas init` (docs/RELEASE.md):
 *   EXPO_UPDATES_URL=https://u.expo.dev/<projectId>
 * Until it is set, builds only use their embedded JS — no update checks.
 */
const updatesUrl = process.env.EXPO_UPDATES_URL?.trim() || '';

/**
 * Filled by the user after `eas init` (docs/RELEASE.md): paste the project id
 * printed by the command here (or set EAS_PROJECT_ID). M1-05 needs it for push
 * tokens; EAS commands need it to address the project.
 */
const easProjectId = process.env.EAS_PROJECT_ID?.trim() || '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: variant.name,
  slug: 'mobile-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: variant.scheme,
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: applicationId,
  },
  android: {
    package: applicationId,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'server',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-secure-store',
    'expo-localization',
  ],
  // Runtime version policy for OTA updates (docs/02 §11): one runtime per
  // store-facing version, so `expo-updates` only serves compatible bundles.
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: updatesUrl
    ? { url: updatesUrl }
    : {
        // Placeholder: after `eas init` set EXPO_UPDATES_URL (see docs/RELEASE.md).
        enabled: false,
      },
  extra: easProjectId ? { eas: { projectId: easProjectId } } : undefined,
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
