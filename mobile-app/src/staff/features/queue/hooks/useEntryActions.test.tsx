import { renderHook } from '@testing-library/react-native';

import type { EntryView, SessionView } from '../types/queue.types';
import { useEntryActions } from './useEntryActions';

let mockPerms: string[] = [];
jest.mock('@/staff/features/access', () => ({
  useAccess: () => ({ can: (perm?: string | null) => !perm || mockPerms.includes(perm) }),
}));

const entry = { id: 'e1', status: 'called', patient: null, priorityClass: 'normal' } as EntryView;
const session = { id: 's1', status: 'open' } as SessionView;

describe('useEntryActions', () => {
  it('feeds the caller permissions into availableEntryActions', async () => {
    mockPerms = ['queue.doctor.own'];
    const { result } = await renderHook(() => useEntryActions(entry, session, 'doctor'));
    expect(result.current).toEqual(['start', 'recall', 'undo-call', 'skip']);
  });

  it('hides permission-gated actions without the permission', async () => {
    mockPerms = [];
    const { result } = await renderHook(() => useEntryActions(entry, session, 'doctor'));
    expect(result.current).toEqual(['skip']);
  });
});
