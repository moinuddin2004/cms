import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { useStaffAuthStore, type SessionPayload } from '@/staff/store/useStaffAuthStore';

import { beginStaffSignOut, dropSession, endStaffSignOut, refreshSession } from './api';
import { getRefreshToken, setRefreshToken } from './session';

jest.mock('./persist-cache', () => ({ wipeStaffPersistedCache: jest.fn() }));

function session(n: number): SessionPayload {
  return {
    user: { uuid: 'u1', email: 'd@example.com', name: 'Doc', globalRole: null },
    accessToken: `access-${n}`,
    refreshToken: `session:token-${n}`,
    isSuperAdmin: false,
    accessSource: 'owner',
    requiresOrgSelection: false,
    requiresLocationSelection: false,
    accessibleOrganizations: [],
    activeOrganizationId: null,
    activeLocationId: null,
  };
}

function response(data: unknown): AxiosResponse {
  return { data: { data }, status: 200, statusText: 'OK', headers: {}, config: {} as InternalAxiosRequestConfig };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('staff sign-out vs a refresh in flight', () => {
  beforeEach(async () => {
    useStaffAuthStore.getState().setSession(session(1));
    await setRefreshToken('session:token-1');
  });

  afterEach(() => jest.restoreAllMocks());

  it('refresh in flight → sign-out → refresh resolves: still signed out, nothing stored, new token revoked', async () => {
    let resolveRefresh!: (r: AxiosResponse) => void;
    const post = jest
      .spyOn(axios, 'post')
      .mockImplementationOnce(() => new Promise<AxiosResponse>((resolve) => (resolveRefresh = resolve)))
      .mockResolvedValue(response({ ok: true }));

    const refresh = refreshSession();
    await tick();
    // the exact order of useSignOut
    let begun = false;
    const out = (async () => {
      await beginStaffSignOut();
      begun = true;
      await dropSession();
      endStaffSignOut();
    })();
    await tick();
    expect(begun).toBe(false); // waits for the refresh in flight

    resolveRefresh(response(session(2)));
    await out;

    await expect(refresh).resolves.toBeNull();
    expect(await getRefreshToken()).toBeNull();
    const state = useStaffAuthStore.getState();
    expect(state.status).toBe('signedOut');
    expect(state.accessToken).toBeNull();
    const [url, , options] = post.mock.calls[1];
    expect(String(url)).toMatch(/\/auth\/logout$/);
    expect(options?.headers).toMatchObject({ 'x-refresh-token': 'session:token-2' });
  });

  it('a refresh that starts between begin and end of sign-out is discarded too', async () => {
    jest.spyOn(axios, 'post').mockResolvedValueOnce(response(session(2))).mockResolvedValue(response({}));
    await beginStaffSignOut();
    await expect(refreshSession()).resolves.toBeNull();
    endStaffSignOut();
    expect(await getRefreshToken()).toBe('session:token-1');
  });
});
