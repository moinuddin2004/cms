import NetInfo from '@react-native-community/netinfo';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Screen } from './Screen';

jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});

type Listener = (s: { isConnected: boolean | null }) => void;

function captureListener() {
  let listener: Listener = () => {};
  (NetInfo.addEventListener as jest.Mock).mockImplementationOnce((l: Listener) => {
    listener = l;
    return jest.fn();
  });
  return (s: { isConnected: boolean | null }) => listener(s);
}

describe('Screen offline banner', () => {
  it('shows saved-data time when offline and hides when back online', async () => {
    const emit = captureListener();
    await render(
      <Screen savedAt="10:42 AM">
        <Text>body</Text>
      </Screen>,
    );
    expect(screen.queryByText(/saved data/)).toBeNull();

    await act(async () => emit({ isConnected: false }));
    expect(screen.getByText('Showing saved data from 10:42 AM')).toBeTruthy();

    await act(async () => emit({ isConnected: true }));
    expect(screen.queryByText(/saved data/)).toBeNull();
  });

  it('says offline when there is no saved time', async () => {
    const emit = captureListener();
    await render(
      <Screen>
        <Text>body</Text>
      </Screen>,
    );
    await act(async () => emit({ isConnected: false }));
    expect(screen.getByText('You are offline')).toBeTruthy();
  });
});
