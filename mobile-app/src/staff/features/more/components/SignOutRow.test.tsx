import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SignOutRow } from './SignOutRow';

const mockMutateAsync = jest.fn(async () => undefined);

jest.mock('@/staff/features/auth', () => ({
  useSignOut: () => ({ mutateAsync: mockMutateAsync }),
}));

// Stand-in for the real dialog: renders its confirm button only while open.
jest.mock('@/core/components', () => {
  const { Pressable: P, Text: T } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ListRow: ({ title, onPress }: { title: string; onPress: () => void }) => (
      <P accessibilityRole="button" onPress={onPress}>
        <T>{title}</T>
      </P>
    ),
    ConfirmDialog: ({
      open,
      confirmLabel,
      onConfirm,
    }: {
      open: boolean;
      confirmLabel: string;
      onConfirm: () => void;
    }): ReactNode =>
      open ? (
        <P accessibilityRole="button" accessibilityLabel="dialog-confirm" onPress={onConfirm}>
          <T>{confirmLabel}</T>
        </P>
      ) : null,
  };
});

describe('SignOutRow', () => {
  beforeEach(() => mockMutateAsync.mockClear());

  it('does not sign out on the row press — only after the dialog is confirmed', async () => {
    await render(<SignOutRow />);
    expect(screen.queryByLabelText('dialog-confirm')).toBeNull();

    await fireEvent.press(screen.getByText('Sign out'));
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByLabelText('dialog-confirm')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('dialog-confirm'));
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  });
});
