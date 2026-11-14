import { render, screen, act } from '@testing-library/react-native';
import { toast } from 'sonner-native';

import { EntryActionsHost } from './EntryActionsHost';
import { useBoardUiStore } from './useBoardUiStore';

jest.mock('sonner-native', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/staff/features/access', () => ({ useAccess: () => ({ can: () => true }) }));
jest.mock('@/core/ui/alert-dialog', () => ({}));
jest.mock('@/core/components', () => ({
  ActionSheet: () => null,
  ConfirmDialog: () => null,
}));

// Expose the urgent sheet's submit so the test can drive it.
let mockUrgentSubmit: ((reason: string) => Promise<unknown>) | undefined;
jest.mock('./UrgentReasonSheet', () => ({
  UrgentReasonSheet: (p: { onSubmit: (reason: string) => Promise<unknown> }) => {
    mockUrgentSubmit = p.onSubmit;
    return null;
  },
}));

const lane = {
  doctor: { id: 'd1', fullName: 'Dr One' },
  snapshot: { session: { id: 's', status: 'open' }, entries: [], waitingOrder: [], now: '' },
  waitingCount: 0,
} as never;
const actions = { markUrgent: jest.fn() } as never;

describe('EntryActionsHost: entry left the queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useBoardUiStore.setState(useBoardUiStore.getInitialState());
  });

  it('Mark urgent on a vanished entry closes the sheet and toasts', async () => {
    useBoardUiStore.setState({ flow: { kind: 'urgent', entryId: 'gone' } });
    await render(<EntryActionsHost lane={lane} doctors={[]} actions={actions} />);
    await act(async () => {
      await expect(mockUrgentSubmit?.('Bleeding')).rejects.toThrow();
    });
    expect(toast.error).toHaveBeenCalledWith('This patient is no longer in the queue.');
    expect(useBoardUiStore.getState().flow).toBeNull();
    expect(screen).toBeTruthy();
  });
});
