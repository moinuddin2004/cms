import axios from 'axios';

import { getPref, setPref } from '@/core/storage/prefs';
import { notificationKeys } from '@/staff/features/notifications/api/notifications.keys';
import { useStaffAuthStore, type SessionPayload } from '@/staff/store/useStaffAuthStore';

import { clearStaffEvents } from './analytics';
import { refreshSession } from './api';
import './forced-sign-out';
import { staffQueryClient } from './query-client';
import { getRefreshToken, setRefreshToken } from './session';

jest.mock('./persist-cache', () => ({ wipeStaffPersistedCache: jest.fn() }));
jest.mock('./analytics', () => ({ clearStaffEvents: jest.fn() }));

function session(uuid: string): SessionPayload {
  return {
    user: { uuid, email: 'd@example.com', name: 'Doc', globalRole: null },
    accessToken: 'access',
    refreshToken: 'session:token',
    isSuperAdmin: false,
    accessSource: 'owner',
    requiresOrgSelection: false,
    requiresLocationSelection: false,
    accessibleOrganizations: [],
    activeOrganizationId: null,
    activeLocationId: null,
  };
}

describe('forced staff sign-out (audit M1, L16, L17)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useStaffAuthStore.getState().setSession(session('user-a'));
    await setRefreshToken('session:token');
    setPref('staff.theme.cache', '{"orgId":"o"}');
    staffQueryClient.setQueryData(['patients', 'detail', 'p1'], { firstName: 'Ali' });
  });

  afterEach(() => jest.restoreAllMocks());

  it('a rejected refresh clears the query cache, queued events and the theme cache, like a voluntary sign-out', async () => {
    jest.spyOn(axios, 'post').mockRejectedValueOnce(Object.assign(new Error('401'), { response: { status: 401 } }));
    staffQueryClient.setQueryData(notificationKeys.unreadCount('user-a'), 3);

    await expect(refreshSession()).resolves.toBeNull();

    expect(useStaffAuthStore.getState().status).toBe('signedOut');
    expect(await getRefreshToken()).toBeNull();
    expect(staffQueryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(clearStaffEvents).toHaveBeenCalled();
    expect(getPref('staff.theme.cache')).toBeUndefined();
  });

  it('a network failure is not a sign-out: nothing is cleared', async () => {
    jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('Network Error'));
    await expect(refreshSession()).rejects.toThrow();
    expect(useStaffAuthStore.getState().status).toBe('signedIn');
    expect(staffQueryClient.getQueryData(['patients', 'detail', 'p1'])).toBeDefined();
    expect(getPref('staff.theme.cache')).toBeDefined();
  });
});

describe('user-scoped query keys (audit M1)', () => {
  it('notification keys differ per user and keep their prefixes', () => {
    expect(notificationKeys.unreadCount('a')).not.toEqual(notificationKeys.unreadCount('b'));
    expect(notificationKeys.inbox(false, 'a')).not.toEqual(notificationKeys.inbox(false, 'b'));
    expect(notificationKeys.prefs('a')).not.toEqual(notificationKeys.prefs('b'));
    expect(notificationKeys.inbox(false, 'a').slice(0, 2)).toEqual(notificationKeys.list());
  });
});
