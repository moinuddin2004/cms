import { render, screen } from '@testing-library/react-native';

import { fetchMinVersion } from './min-version';
import { RootShell } from './RootShell';

jest.mock('./min-version', () => ({ fetchMinVersion: jest.fn() }));
jest.mock('./RootProviders', () => ({
  RootProviders: function RootProviders({ children }: { children: React.ReactNode }) {
    return children;
  },
}));
jest.mock('./UpdateRequiredPage', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    UpdateRequiredPage: function UpdateRequiredPage() {
      return <Text>update-required</Text>;
    },
  };
});
jest.mock('expo-router', () => {
  function Passthrough({ children }: { children?: React.ReactNode }) {
    return children ?? null;
  }
  function Empty() {
    return null;
  }
  return { Stack: Object.assign(Passthrough, { Screen: Empty, Protected: Passthrough }) };
});
jest.mock('@/core/app-version', () => ({ isBelow: (v: string) => v === '9.9.9' }));
jest.mock('@/core/notifications/channels', () => ({
  createNotificationChannels: jest.fn().mockResolvedValue(undefined),
}));

describe('RootShell min-version gate', () => {
  it('replaces the app with the update screen when the build is below the floor', async () => {
    (fetchMinVersion as jest.Mock).mockResolvedValue({ android: '9.9.9', ios: '9.9.9' });

    await render(<RootShell />);

    expect(await screen.findByText('update-required')).toBeTruthy();
    expect(fetchMinVersion).toHaveBeenCalledTimes(1);
  });
});
