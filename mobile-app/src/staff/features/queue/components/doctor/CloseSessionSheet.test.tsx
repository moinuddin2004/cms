import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { EntryView, SessionView } from '../../types/queue.types';
import { CloseSessionSheet } from './CloseSessionSheet';

jest.mock('../../hooks/useDoctorChoices', () => ({
  useDoctorChoices: () => ({
    data: [
      { id: 'me', fullName: 'Dr Me' },
      { id: 'd2', fullName: 'Dr Imran' },
    ],
    isPending: false,
    isError: false,
  }),
}));
jest.mock('@/core/components/overlays/FormSheet', () => ({
  FormSheet: ({
    open,
    children,
    submit,
  }: {
    open: boolean;
    children: React.ReactNode;
    submit?: { label: string; onPress: () => void; disabled?: boolean };
  }) => {
    const { View, Text, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
    if (!open) return null;
    return (
      <View>
        {children}
        {submit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit close"
            accessibilityState={{ disabled: !!submit.disabled }}
            disabled={submit.disabled}
            onPress={submit.onPress}>
            <Text>{submit.label}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  },
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => false }) }));
jest.mock('@gorhom/bottom-sheet', () => {
  const { TextInput } = jest.requireActual<typeof import('react-native')>('react-native');
  return { BottomSheetTextInput: TextInput };
});
jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual<typeof import('react-native')>('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const hooks: Record<string, unknown> = {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
  };
  return new Proxy(hooks, { get: (t, k: string) => (k in t ? t[k] : (f: unknown) => f) });
});

const entry = (id: string, status: EntryView['status'], at: string) =>
  ({ id, token: `A-${id}`, status, checkedInAt: at, patient: { id: `p${id}`, fullName: `Pat ${id}` } }) as unknown as EntryView;

const session = { id: 's1', doctorId: 'me' } as SessionView;
const entries = [
  entry('1', 'waiting', '2026-11-15T05:00:00Z'),
  entry('2', 'skipped', '2026-11-15T05:10:00Z'),
  entry('3', 'on_hold', '2026-11-15T05:20:00Z'),
];

describe('CloseSessionSheet', () => {
  it('3 leftovers send 3 decisions once the waiting patient is decided', async () => {
    const onConfirm = jest.fn(() => Promise.resolve());
    await render(
      <CloseSessionSheet open onClose={jest.fn()} session={session} entries={entries} onConfirm={onConfirm} />,
    );
    const submit = () => screen.getByLabelText('Submit close');
    expect(submit().props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByText('Transfer'));
    // Own doctor is not a target.
    expect(screen.queryByText('Dr Me')).toBeNull();
    await fireEvent.press(screen.getByText('Dr Imran'));
    expect(submit().props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(submit());
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith([
      { entryId: '1', action: 'transfer', toDoctorId: 'd2' },
      { entryId: '2', action: 'cancel' },
      { entryId: '3', action: 'cancel' },
    ]);
  });

  it('with no leftovers closing needs no decisions', async () => {
    const onConfirm = jest.fn(() => Promise.resolve());
    await render(
      <CloseSessionSheet open onClose={jest.fn()} session={session} entries={[]} onConfirm={onConfirm} />,
    );
    await fireEvent.press(screen.getByLabelText('Submit close'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith([]));
  });
});
