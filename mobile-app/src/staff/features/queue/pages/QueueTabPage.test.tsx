import { render, screen } from '@testing-library/react-native';

import { QueueTabPage } from './QueueTabPage';

let mockParams: { segment?: string; doctorId?: string } = {};
let mockGrants = new Set<string>();
let mockSaved: string | undefined;
const mockSelectDoctor = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: jest.fn() }),
}));
jest.mock('@/staff/features/access', () => ({
  useAccess: () => ({ can: (p: string) => mockGrants.has(p) }),
}));
jest.mock('@/staff/features/notifications', () => ({ NotificationBell: () => null }));
jest.mock('@/core/storage/prefs', () => ({
  getPref: () => mockSaved,
  setPref: jest.fn(),
}));
jest.mock('@/core/components', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  const rn = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Screen: ({ children }: { children: React.ReactNode }) => R.createElement(rn.View, null, children),
    ScreenHeader: () => null,
    SegmentedControl: () => null,
  };
});
const mockLabel = (text: string) => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const R = jest.requireActual<typeof import('react')>('react');
  return R.createElement(Text, null, text);
};
jest.mock('../components/BoardView', () => ({ BoardView: () => mockLabel('board-view') }));
jest.mock('../components/DoctorQueueView', () => ({
  DoctorQueueView: () => mockLabel('doctor-view'),
}));
jest.mock('../components/board/useBoardUiStore', () => ({
  useBoardUiStore: (sel: (s: unknown) => unknown) => sel({ selectDoctor: mockSelectDoctor }),
}));

const DOCTOR = '0b9f2c1e-1111-4222-8333-444455556666';

beforeEach(() => {
  mockParams = {};
  mockSaved = undefined;
  mockSelectDoctor.mockClear();
  mockGrants = new Set(['queue.doctor.own', 'queue.board.view']);
});

describe('QueueTabPage segment', () => {
  it('?segment=board overrides a saved "doctor" choice', async () => {
    mockSaved = 'doctor';
    mockParams = { segment: 'board' };
    await render(<QueueTabPage />);
    expect(screen.getByText('board-view')).toBeTruthy();
  });

  it('?segment=doctor overrides a saved "board" choice', async () => {
    mockSaved = 'board';
    mockParams = { segment: 'doctor' };
    await render(<QueueTabPage />);
    expect(screen.getByText('doctor-view')).toBeTruthy();
  });

  it('uses the saved choice without a param', async () => {
    mockSaved = 'board';
    await render(<QueueTabPage />);
    expect(screen.getByText('board-view')).toBeTruthy();
  });

  it('a board-only user always gets the board', async () => {
    mockGrants = new Set(['queue.board.view']);
    mockParams = { segment: 'doctor' };
    await render(<QueueTabPage />);
    expect(screen.getByText('board-view')).toBeTruthy();
  });
});

describe('QueueTabPage doctorId param', () => {
  it('selects that doctor lane', async () => {
    mockParams = { segment: 'board', doctorId: DOCTOR };
    await render(<QueueTabPage />);
    expect(mockSelectDoctor).toHaveBeenCalledWith(DOCTOR);
  });

  it('ignores a malformed id', async () => {
    mockParams = { segment: 'board', doctorId: 'not-a-uuid' };
    await render(<QueueTabPage />);
    expect(mockSelectDoctor).not.toHaveBeenCalled();
  });
});
