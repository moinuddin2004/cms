import NetInfo from '@react-native-community/netinfo';
import { act, render, screen } from '@testing-library/react-native';

import { OfflineAwareButton } from './OfflineAwareButton';

it('is disabled and labelled "Offline" without a connection', async () => {
  let listener: (s: { isConnected: boolean | null }) => void = () => {};
  (NetInfo.addEventListener as jest.Mock).mockImplementationOnce((l: typeof listener) => {
    listener = l;
    return jest.fn();
  });
  await render(<OfflineAwareButton label="Check in" onPress={jest.fn()} />);
  expect(screen.getByText('Check in')).toBeTruthy();

  await act(async () => listener({ isConnected: false }));
  expect(screen.getByText('Offline')).toBeTruthy();
  expect(screen.getByRole('button')).toBeDisabled();
});
