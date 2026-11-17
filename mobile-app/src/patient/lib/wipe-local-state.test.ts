import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';

import { usePendingClaimStore } from '@/core/claim/usePendingClaimStore';
import { clearMedicationLocalState } from '@/patient/features/medications';
import { usePatientPushRouteStore } from '@/patient/features/devices/store/usePatientPushRouteStore';
import { clearPatientEvents } from '@/patient/lib/analytics';
import { wipePatientPersistedCache } from '@/patient/lib/persist-cache';

import { refreshSession } from './api';
import { getRefreshToken, setRefreshToken } from './session';
import { wipePatientLocalState } from './wipe-local-state';

jest.mock('@/patient/lib/analytics', () => ({ clearPatientEvents: jest.fn() }));
jest.mock('@/patient/lib/persist-cache', () => ({ wipePatientPersistedCache: jest.fn(async () => undefined) }));
jest.mock('@/patient/features/medications', () => ({ clearMedicationLocalState: jest.fn(async () => undefined) }));

const order: string[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  order.length = 0;
  (clearPatientEvents as jest.Mock).mockImplementation(() => order.push('events'));
  (wipePatientPersistedCache as jest.Mock).mockImplementation(async () => order.push('cache'));
  (clearMedicationLocalState as jest.Mock).mockImplementation(async () => order.push('reminders'));
});

describe('wipePatientLocalState (shared by voluntary and forced sign-out)', () => {
  it('clears every kind of local patient state, persisted cache before the in-memory client', async () => {
    const client = new QueryClient();
    client.setQueryData(['medications', 'acc-1'], [{ id: 's1' }]);
    usePendingClaimStore.getState().set('a'.repeat(43));
    usePatientPushRouteStore.getState().setPending({
      space: 'patient',
      type: 'queue.called',
      route: '/',
      organizationId: null,
      locationId: null,
      entityId: null,
    });
    const clear = jest.spyOn(client, 'clear').mockImplementation(() => order.push('client'));

    await wipePatientLocalState(client);

    expect(clearPatientEvents).toHaveBeenCalledTimes(1);
    expect(clearMedicationLocalState).toHaveBeenCalledTimes(1); // cancels reminders + resets the dose queue
    expect(usePendingClaimStore.getState().token).toBeNull();
    expect(usePatientPushRouteStore.getState().pending).toBeNull();
    expect(order).toEqual(['events', 'cache', 'reminders', 'client']);
    clear.mockRestore();
  });

  it('one failing step never stops the others', async () => {
    (wipePatientPersistedCache as jest.Mock).mockRejectedValue(new Error('disk'));
    (clearMedicationLocalState as jest.Mock).mockRejectedValue(new Error('os'));
    const client = new QueryClient();
    client.setQueryData(['x'], 1);
    await wipePatientLocalState(client);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(usePatientPushRouteStore.getState().pending).toBeNull();
  });
});

describe('forced sign-out (server revoked the session) runs the same wipe', () => {
  it('a rejected refresh clears reminders, claim, push tap, analytics and the cache, then drops the session', async () => {
    await setRefreshToken('session:token-1');
    usePendingClaimStore.getState().set('b'.repeat(43));
    jest
      .spyOn(axios, 'post')
      .mockRejectedValue(Object.assign(new Error('401'), { isAxiosError: true, response: { status: 401 } }));

    await expect(refreshSession()).resolves.toBeNull();

    expect(clearMedicationLocalState).toHaveBeenCalledTimes(1);
    expect(clearPatientEvents).toHaveBeenCalledTimes(1);
    expect(wipePatientPersistedCache).toHaveBeenCalledTimes(1);
    expect(usePendingClaimStore.getState().token).toBeNull();
    expect(await getRefreshToken()).toBeNull();
    jest.restoreAllMocks();
  });
});
