import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { usePendingClaimStore } from '@/core/claim/usePendingClaimStore';
import { en } from '@/core/i18n/en';

import { ClaimConfirmPage } from './ClaimConfirmPage';

const TOKEN = 'a'.repeat(43);
const mockReplace = jest.fn();
let mockPreview: Record<string, unknown>;
let mockOnTerminal: ((key: string) => void) | undefined;

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/core/components', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    LoadingSkeleton: () => null,
    ErrorState: ({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) => (
      <>
        <Text>{message}</Text>
        <Pressable onPress={onRetry}>
          <Text>{retryLabel}</Text>
        </Pressable>
      </>
    ),
  };
});
jest.mock('@/core/components/forms/FormInput', () => ({ FormInput: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('../hooks/useClaimPreview', () => ({ useClaimPreview: () => mockPreview }));
jest.mock('../hooks/useClaimForm', () => ({
  useClaimForm: (_t: string, _m: boolean, _l: unknown, onTerminal: (key: string) => void) => {
    mockOnTerminal = onTerminal;
    return {
      form: {
        Field: () => null,
        Subscribe: () => null,
      },
      globalError: '',
    };
  },
}));

const previewData = {
  clinic: { name: 'City Dental' },
  location: { name: 'Main' },
  maskedName: 'Ali R. K.',
  ageBand: '18-39',
  isMinor: false,
  alreadyLinkedToYou: false,
};

beforeEach(() => {
  mockReplace.mockClear();
  usePendingClaimStore.getState().set(TOKEN);
});
afterEach(() => usePendingClaimStore.getState().clear());

describe('ClaimConfirmPage', () => {
  it('lets the patient leave after a recoverable preview error (offline / rate limit)', async () => {
    mockPreview = {
      isPending: false,
      isError: true,
      error: new Error('offline'),
      refetch: jest.fn(),
    };
    await render(<ClaimConfirmPage />);

    await fireEvent.press(screen.getByText(en.claim.confirm.cancel));

    expect(usePendingClaimStore.getState().token).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('explains a terminal accept error and drops the token only on Close', async () => {
    mockPreview = { isPending: false, isError: false, data: previewData };
    await render(<ClaimConfirmPage />);

    await act(async () => mockOnTerminal?.('claim.errors.alreadyLinked'));

    expect(screen.getByText(en.claim.errors.alreadyLinked)).toBeTruthy();
    expect(usePendingClaimStore.getState().token).toBe(TOKEN);
    expect(mockReplace).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText(en.claim.invalid.action));
    expect(usePendingClaimStore.getState().token).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
