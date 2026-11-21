import { act, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter, screen as routerScreen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { useSpaceStore } from '@/core/space/useSpaceStore';

import { EntryRedirect } from './EntryRedirect';
import { RootShell } from './RootShell';

jest.mock('@/core/space/useSpaceStore', () => {
  const { create } = jest.requireActual('zustand');
  return {
    useSpaceStore: create(() => ({ activeSpace: null, setActiveSpace: () => undefined })),
  };
});
jest.mock('./min-version', () => ({ fetchMinVersion: jest.fn().mockResolvedValue(null) }));
jest.mock('./notification-router', () => ({ useNotificationTaps: jest.fn() }));
jest.mock('./DevRouteTrace', () => ({ DevRouteTrace: () => null }));
jest.mock('./RootProviders', () => ({
  RootProviders: function RootProviders({ children }: { children: React.ReactNode }) {
    return children;
  },
}));
jest.mock('./UpdateRequiredPage', () => ({ UpdateRequiredPage: () => null }));
jest.mock('@/patient', () => ({ replanPatientReminders: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/core/notifications/channels', () => ({
  createNotificationChannels: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/core/notifications/foreground', () => ({ installForegroundHandler: jest.fn() }));

function screenNamed(label: string) {
  return function NamedScreen() {
    return <Text>{label}</Text>;
  };
}

function Plain() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

/**
 * The real root layout over the real route shape. What matters: the patient home tab is
 * `(patient)/(main)/(tabs)/index`, so "/" matches it as well as the root `index`.
 */
const routes = {
  _layout: RootShell,
  index: EntryRedirect,
  welcome: screenNamed('welcome'),
  '(staff)/_layout': Plain,
  '(staff)/login': screenNamed('staff-login'),
  '(patient)/_layout': Plain,
  '(patient)/sign-in': screenNamed('patient-sign-in'),
  '(patient)/(main)/_layout': Plain,
  '(patient)/(main)/(tabs)/_layout': Plain,
  '(patient)/(main)/(tabs)/index': screenNamed('patient-home'),
};

const setSpace = (activeSpace: 'staff' | 'patient' | null) =>
  act(async () => useSpaceStore.setState({ activeSpace }));

describe('RootShell space guards', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error');
  });
  afterEach(() => {
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('Maximum update depth');
    consoleError.mockRestore();
  });

  it('opens the welcome picker when no space is chosen', async () => {
    useSpaceStore.setState({ activeSpace: null });
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.getByText('welcome')).toBeTruthy();
  });

  it('picking a space opens its first screen', async () => {
    useSpaceStore.setState({ activeSpace: null });
    await renderRouter(routes, { initialUrl: '/' });
    await setSpace('patient');
    expect(routerScreen).toHavePathname('/sign-in');
  });

  // Regression: Back on staff login / patient sign-in (switchSpace(null)) looped forever.
  it.each(['staff', 'patient'] as const)(
    'Back from the %s sign-in returns to welcome without a loop',
    async (space) => {
      useSpaceStore.setState({ activeSpace: null });
      await renderRouter(routes, { initialUrl: '/' });
      await setSpace(space);
      await setSpace(null);
      expect(routerScreen).toHavePathname('/welcome');
      expect(screen.getByText('welcome')).toBeTruthy();
    },
  );

  it('switching straight from one space to the other opens its first screen', async () => {
    useSpaceStore.setState({ activeSpace: 'staff' });
    await renderRouter(routes, { initialUrl: '/' });
    await setSpace('patient');
    expect(routerScreen).toHavePathname('/sign-in');
  });
});
