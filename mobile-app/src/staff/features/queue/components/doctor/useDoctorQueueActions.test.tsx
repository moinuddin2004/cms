import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { toast } from 'sonner-native';

import type { EntryView } from '../../types/queue.types';
import { useDoctorQueueActions } from './useDoctorQueueActions';

jest.mock('sonner-native', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

const mockCallNext = jest.fn();
const mockComplete = jest.fn();
const mockSendForTest = jest.fn();
const mockSelect = jest.fn();
jest.mock('../../api/queue.api', () => ({
  callNext: (...a: unknown[]) => mockCallNext(...a),
  completeEntry: (...a: unknown[]) => mockComplete(...a),
  sendForTest: (...a: unknown[]) => mockSendForTest(...a),
  selectEntry: (...a: unknown[]) => mockSelect(...a),
}));

const entry = { id: 'e1', version: 7, token: 'A-007' } as EntryView;
const clients: QueryClient[] = [];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  clients.push(client);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useDoctorQueueActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    clients.splice(0).forEach((c) => c.clear());
    await cleanup();
  });

  it('Call next with NO_ELIGIBLE_PATIENT toasts "No one is waiting" and announces nothing', async () => {
    mockCallNext.mockResolvedValue({ entry: null, reason: 'NO_ELIGIBLE_PATIENT', eventSeq: 1 });
    const { result } = await renderHook(() => useDoctorQueueActions(), { wrapper });

    await act(async () => {
      await result.current.callNext('s1');
    });

    expect(toast).toHaveBeenCalledWith('No one is waiting');
    expect(toast.error).not.toHaveBeenCalled();
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  });

  it('Call next announces the called patient to screen readers', async () => {
    mockCallNext.mockResolvedValue({
      entry: { token: 'A-008', patient: { fullName: 'Sara K.' } },
      reason: 'FIFO',
      eventSeq: 2,
    });
    const { result } = await renderHook(() => useDoctorQueueActions(), { wrapper });

    await act(async () => {
      await result.current.callNext('s1');
    });

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Called A-008, Sara K.',
    );
  });

  it('announces the patient after a successful out-of-order select', async () => {
    mockSelect.mockResolvedValue({
      entry: { token: 'A-009', patient: { fullName: 'Umar' } },
      reason: 'MANUAL_SELECT',
      suggestedEntryId: null,
      eventSeq: 5,
    });
    const { result } = await renderHook(() => useDoctorQueueActions(), { wrapper });

    await act(async () => {
      await result.current.select(entry, 'family');
    });

    expect(mockSelect).toHaveBeenCalledWith(
      { entryId: 'e1', version: 7, reason: 'family' },
      expect.objectContaining({ ifMatch: 7 }),
    );
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Called A-009, Umar');
  });

  it('locks the entry while one of its actions is pending and sends If-Match from the entry on screen', async () => {
    let finish: (v: unknown) => void = () => undefined;
    mockComplete.mockReturnValue(new Promise((r) => (finish = r)));
    const { result } = await renderHook(() => useDoctorQueueActions(), { wrapper });
    expect(result.current.busyEntryIds.has('e1')).toBe(false);

    await act(async () => {
      result.current.complete(entry);
    });
    await waitFor(() => expect(result.current.busyEntryIds.has('e1')).toBe(true));
    expect(mockComplete).toHaveBeenCalledWith(
      { entryId: 'e1', version: 7 },
      expect.objectContaining({ ifMatch: 7, idempotencyKey: expect.any(String) }),
    );

    await act(async () => {
      finish({ entry, eventSeq: 3 });
    });
    await waitFor(() => expect(result.current.busyEntryIds.has('e1')).toBe(false));
  });

  it('a refused reason action keeps the sheet open; a stale entry lets it close', async () => {
    const { result } = await renderHook(() => useDoctorQueueActions(), { wrapper });
    const failure = (code: string) => ({ response: { status: 409, data: { error: { code } } } });

    mockSendForTest.mockRejectedValueOnce(failure('SESSION_NOT_OPEN'));
    let closed = true;
    await act(async () => {
      closed = await result.current.sendForTest(entry, 'x-ray');
    });
    expect(closed).toBe(false);

    mockSendForTest.mockRejectedValueOnce(failure('VERSION_CONFLICT'));
    await act(async () => {
      closed = await result.current.sendForTest(entry, undefined);
    });
    expect(closed).toBe(true);
    expect(mockSendForTest).toHaveBeenLastCalledWith(
      { entryId: 'e1', version: 7, reason: undefined },
      expect.objectContaining({ ifMatch: 7 }),
    );
  });
});
