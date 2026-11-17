import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * App config (card M0-07, docs/02 §11).
 *
 * `APP_VARIANT` selects the build variant. EAS supplies it from the EAS environment
 * (development / preview / production) the build profile points at; a plain `npx expo start` / `expo run:android` is the
 * development variant. Each variant needs its own package/bundle id so a
 * development build can be installed next to a preview build (Expo docs:
 * "Install app variants on the same device").
 *
 * The package name is the placeholder agreed for now — decision O-01 (final
 * app identity) is still open, so do not use a real domain here.
 */
const VARIANTS = {
  development: {
    name: 'MedTrackr (Dev)',
    idSuffix: '.dev',
    scheme: 'clinicapp-dev',
  },
  preview: {
    name: 'MedTrackr (Preview)',
    idSuffix: '.preview',
    scheme: 'clinicapp-preview',
  },
  production: {
    name: 'MedTrackr',
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
 * EAS project id — not a secret. Placeholder until the user runs `eas init`
 * (docs/RELEASE.md §2): paste the id it prints between the quotes below.
 * Leave it empty and updates stay disabled. M1-05 needs it for push tokens.
 */
const EAS_PROJECT_ID = '';

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
    icon: './assets/images/icon.png',
    bundleIdentifier: applicationId,
  },
  android: {
    package: applicationId,
    adaptiveIcon: {
      // Brand mark from the web app (web-app/public/favicon.svg); regenerate the PNGs with
      // `python mobile-app/scripts/make-brand-assets.py`.
      backgroundColor: '#2563EB',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFFFFF',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
        dark: { backgroundColor: '#0F172A', image: './assets/images/splash-icon.png' },
      },
    ],
    'expo-secure-store',
    'expo-localization',
    'expo-font',
    [
      'expo-notifications',
      {
        // Android status-bar icon: the white brand "M" on transparent, tinted with the brand blue.
        icon: './assets/images/android-icon-monochrome.png',
        color: '#2563EB',
      },
    ],
    // Native Google sign-in (A-20). Android needs no plugin options; iOS needs the reversed
    // iOS client id as a URL scheme, so the plugin is added only once that is configured.
    ...(process.env.GOOGLE_IOS_URL_SCHEME
      ? [
          [
            '@react-native-google-signin/google-signin',
            { iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME },
          ] as [string, { iosUrlScheme: string }],
        ]
      : []),
  ],
  // Runtime version policy for OTA updates (docs/02 §11): one runtime per
  // store-facing version, so `expo-updates` only serves compatible bundles.
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: EAS_PROJECT_ID
    ? { url: `https://u.expo.dev/${EAS_PROJECT_ID}` }
    : { enabled: false },
  extra: EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : undefined,
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
