import axios, {
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { useStaffAuthStore, type SessionPayload } from '@/staff/store/useStaffAuthStore';

import { wipeStaffPersistedCache } from './persist-cache';
import { getRefreshToken, setRefreshToken } from './session';
import { staffApi } from './api';

jest.mock('./persist-cache', () => ({ wipeStaffPersistedCache: jest.fn() }));

/**
 * The staff client refreshes once for concurrent 401s (docs/02 §5): the
 * backend rotates the refresh token on every call, so two parallel refreshes
 * would invalidate each other. This test drives two requests through the real
 * axios instance and interceptor and asserts a single `/auth/refresh` call.
 */
const refreshedSession: SessionPayload = {
  user: {
    uuid: 'user-1',
    email: 'doctor@example.com',
    name: 'Doctor',
    globalRole: null,
  },
  accessToken: 'refreshed-access',
  refreshToken: 'session-2:token-2',
  isSuperAdmin: false,
  accessSource: 'owner',
  requiresOrgSelection: false,
  requiresLocationSelection: false,
  accessibleOrganizations: [],
  activeOrganizationId: null,
  activeLocationId: null,
};

function authorizedResponse(
  config: InternalAxiosRequestConfig,
  data: unknown,
): AxiosResponse {
  return { data: { data }, status: 200, statusText: 'OK', headers: {}, config };
}

function unauthorized(config: InternalAxiosRequestConfig): Error {
  return Object.assign(new Error('Request failed with status code 401'), {
    config,
    isAxiosError: true,
    response: { status: 401, statusText: 'Unauthorized', headers: {}, data: {}, config },
  });
}

describe('staff api single-flight refresh', () => {
  const defaultAdapter = staffApi.defaults.adapter;

  beforeEach(async () => {
    useStaffAuthStore.getState().clearAuth();
    await setRefreshToken('session-1:token-1');
  });

  afterEach(() => {
    staffApi.defaults.adapter = defaultAdapter;
    jest.restoreAllMocks();
  });

  it('refreshes once for two parallel 401s and retries both requests', async () => {
    let refreshCalls = 0;
    let resolveRefresh!: (response: AxiosResponse) => void;
    const refreshGate = new Promise<AxiosResponse>((resolve) => {
      resolveRefresh = resolve;
    });

    const post = jest.spyOn(axios, 'post').mockImplementation(() => {
      refreshCalls += 1;
      return refreshGate;
    });

    let firstAttempts = 0;
    let bothRejected!: () => void;
    const bothUnauthorized = new Promise<void>((resolve) => {
      bothRejected = resolve;
    });
    let retries = 0;

    staffApi.defaults.adapter = async (config) => {
      if (String(config.headers.Authorization) === 'Bearer refreshed-access') {
        retries += 1;
        return authorizedResponse(config, { ok: true });
      }
      firstAttempts += 1;
      if (firstAttempts === 2) bothRejected();
      throw unauthorized(config);
    };

    const first = staffApi.get('/queue/board');
    const second = staffApi.get('/schedule/today');

    // Both requests were rejected with 401 while the refresh is still pending.
    await bothUnauthorized;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(post).toHaveBeenCalledTimes(1);

    resolveRefresh({
      data: { data: refreshedSession },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    });

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);

    expect(refreshCalls).toBe(1);
    expect(retries).toBe(2);
    expect(useStaffAuthStore.getState().accessToken).toBe('refreshed-access');
    expect(await getRefreshToken()).toBe('session-2:token-2');
  });

  it('wipes the encrypted staff cache when the refresh is rejected (forced sign-out)', async () => {
    (wipeStaffPersistedCache as jest.Mock).mockClear();
    jest.spyOn(axios, 'post').mockRejectedValue(
      Object.assign(new Error('401'), { isAxiosError: true, response: { status: 401 } }),
    );
    staffApi.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };
    await expect(staffApi.get('/queue/board')).rejects.toBeDefined();
    expect(wipeStaffPersistedCache).toHaveBeenCalledTimes(1);
    expect(await getRefreshToken()).toBeNull();
  });
});
