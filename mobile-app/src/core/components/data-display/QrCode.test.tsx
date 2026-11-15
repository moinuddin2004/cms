import { render, screen } from '@testing-library/react-native';

import { QrCode } from './QrCode';

let mockFail = false;
jest.mock('react-native-qrcode-svg', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ value, onError }: { value: string; onError: () => void }) => {
      if (mockFail) {
        onError();
        return null;
      }
      return <Text testID="qr">{`qr:${value}`}</Text>;
    },
  };
});

const URL_VALUE = 'https://example.test/c/abc';

describe('QrCode', () => {
  beforeEach(() => {
    mockFail = false;
  });

  it('renders the QR for the value', async () => {
    await render(<QrCode value={URL_VALUE} accessibilityLabel="QR" />);
    expect(screen.getByTestId('qr').props.children).toBe(`qr:${URL_VALUE}`);
  });

  it('falls back to the text when encoding fails', async () => {
    mockFail = true;
    await render(<QrCode value={URL_VALUE} accessibilityLabel="QR" />);
    expect(await screen.findByText(URL_VALUE)).toBeTruthy();
  });
});
