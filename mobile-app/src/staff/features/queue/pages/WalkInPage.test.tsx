import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import { WalkInPage } from './WalkInPage';

let mockPerms: string[] = [];
jest.mock('@/staff/features/access', () => ({
  useAccess: () => ({ can: (p: string) => mockPerms.includes(p) }),
}));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ doctorId: 'd1' }),
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true }),
}));
jest.mock('../hooks/useBoard', () => ({
  useBoard: () => ({
    isPending: false,
    isError: false,
    data: { lanes: [{ doctor: { id: 'd1', fullName: 'Dr One' }, snapshot: null }] },
  }),
}));
jest.mock('../components/board/WalkInPatientSearch', () => ({ WalkInPatientSearch: () => null }));
jest.mock('@/staff/features/patients', () =>
  jest.requireActual('../../patients/schemas/quick-register.schema'),
);
jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: { View } };
});
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetTextInput: jest.requireActual<typeof import('react-native')>('react-native').TextInput,
}));
jest.mock('@/core/components/overlays/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
jest.mock('@/core/components/overlays/FormSheet', () => ({ FormSheet: () => null }));
jest.mock('@/core/components/overlays/ActionSheet', () => ({ ActionSheet: () => null }));
jest.mock('@/core/components/feedback/ConnectionPill', () => ({ ConnectionPill: () => null }));
jest.mock('sonner-native', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }) }));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WalkInPage />
    </QueryClientProvider>,
  );

describe('WalkInPage patient mode', () => {
  it('with patients.view: offers Existing / New patient and starts on Existing', async () => {
    mockPerms = ['patients.view', 'queue.checkin'];
    await renderPage();
    expect(screen.getByText('Existing patient')).toBeTruthy();
    expect(screen.getByText('New patient')).toBeTruthy();
    expect(screen.queryByText(/^Full name/)).toBeNull();
  });

  it('without patients.view: no Existing mode, starts on New patient fields', async () => {
    mockPerms = ['queue.checkin'];
    await renderPage();
    expect(screen.queryByText('Existing patient')).toBeNull();
    expect(screen.getByText(/^Full name/)).toBeTruthy();
    expect(screen.getByText(/^Phone/)).toBeTruthy();
  });
});
