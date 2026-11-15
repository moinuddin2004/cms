import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { usePatientAuthStore, type PatientSessionPayload } from '@/patient/store/usePatientAuthStore';

import { patientApi, refreshSession } from './api';
import { wipePatientPersistedCache } from './persist-cache';
import { getRefreshToken, setRefreshToken } from './session';

jest.mock('./persist-cache', () => ({ wipePatientPersistedCache: jest.fn() }));

/**
 * The backend rotates the patient refresh token on every call and revokes the
 * whole session when an old one is replayed (M2-02 review #8). These tests drive
 * real requests through the real axios instance and interceptor.
 */
function session(n: number): PatientSessionPayload {
  return {
    account: { id: 'acc-1', fullName: 'Ali', email: 'ali@example.com' },
    accessToken: `access-${n}`,
    refreshToken: `session:token-${n}`,
    isNewAccount: false,
    needsName: false,
  };
}

function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data: { data }, status: 200, statusText: 'OK', headers: {}, config };
}

function failure(config: InternalAxiosRequestConfig, status: number): Error {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    config,
    isAxiosError: true,
    response: { status, statusText: 'x', headers: {}, data: {}, config },
  });
}

function axiosResponse(data: unknown): AxiosResponse {
  return { data: { data }, status: 200, statusText: 'OK', headers: {}, config: {} as InternalAxiosRequestConfig };
}

describe('patient api', () => {
  const defaultAdapter = patientApi.defaults.adapter;

  beforeEach(async () => {
    (wipePatientPersistedCache as jest.Mock).mockClear();
    usePatientAuthStore.getState().clearAuth();
    await setRefreshToken('session:token-1');
  });

  afterEach(() => {
    patientApi.defaults.adapter = defaultAdapter;
    jest.restoreAllMocks();
  });

  it('sends the patient bearer token and NEVER tenant headers', async () => {
    usePatientAuthStore.getState().setSession(session(1));
    let seen: InternalAxiosRequestConfig | undefined;
    patientApi.defaults.adapter = async (config) => {
      seen = config;
      return ok(config, {});
    };
    await patientApi.get('/patient-api/me');
    expect(seen?.headers.Authorization).toBe('Bearer access-1');
    expect(seen?.headers['x-client-type']).toBe('mobile');
    expect(seen?.headers['x-organization-id']).toBeUndefined();
    expect(seen?.headers['x-location-id']).toBeUndefined();
  });

  it('refreshes ONCE for two parallel 401s and retries both', async () => {
    let resolveRefresh!: (r: AxiosResponse) => void;
    const gate = new Promise<AxiosResponse>((resolve) => {
      resolveRefresh = resolve;
    });
    const post = jest.spyOn(axios, 'post').mockImplementation(() => gate);

    let firstTries = 0;
    let bothRejected!: () => void;
    const bothUnauthorized = new Promise<void>((resolve) => {
      bothRejected = resolve;
    });
    let retries = 0;
    patientApi.defaults.adapter = async (config) => {
      if (String(config.headers.Authorization) === 'Bearer access-2') {
        retries += 1;
        return ok(config, { ok: true });
      }
      firstTries += 1;
      if (firstTries === 2) bothRejected();
      throw failure(config, 401);
    };

    const first = patientApi.get('/patient-api/links');
    const second = patientApi.get('/patient-api/profiles');
    await bothUnauthorized;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(post).toHaveBeenCalledTimes(1);

    resolveRefresh(axiosResponse(session(2)));
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);

    expect(post).toHaveBeenCalledTimes(1);
    expect(retries).toBe(2);
    expect(usePatientAuthStore.getState().accessToken).toBe('access-2');
    expect(await getRefreshToken()).toBe('session:token-2');
  });

  it('a restore racing a 401 shares the same refresh (no replay of the old token)', async () => {
    let resolveRefresh!: (r: AxiosResponse) => void;
    const gate = new Promise<AxiosResponse>((resolve) => {
      resolveRefresh = resolve;
    });
    const post = jest.spyOn(axios, 'post').mockImplementation(() => gate);
    patientApi.defaults.adapter = async (config) => {
      if (String(config.headers.Authorization) === 'Bearer access-2') return ok(config, {});
      throw failure(config, 401);
    };

    const restore = refreshSession();
    const request = patientApi.get('/patient-api/me');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const again = refreshSession();
    resolveRefresh(axiosResponse(session(2)));

    await Promise.all([restore, request, again]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('calls /patient-auth/refresh with x-patient-refresh-token and rotates the stored token', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValueOnce(axiosResponse(session(2)));
    await refreshSession();
    const [url, , options] = post.mock.calls[0];
    expect(String(url)).toMatch(/\/patient-auth\/refresh$/);
    expect(options?.headers).toMatchObject({
      'x-patient-refresh-token': 'session:token-1',
      'x-client-type': 'mobile',
    });
    expect(await getRefreshToken()).toBe('session:token-2');

    // The next (sequential) refresh uses the ROTATED token, never the old one.
    post.mockResolvedValueOnce(axiosResponse(session(3)));
    await refreshSession();
    expect(post.mock.calls[1][2]?.headers).toMatchObject({
      'x-patient-refresh-token': 'session:token-2',
    });
  });

  it('a rejected refresh (401) signs out: wipes the patient cache and drops the token', async () => {
    jest
      .spyOn(axios, 'post')
      .mockRejectedValue(Object.assign(new Error('401'), { isAxiosError: true, response: { status: 401 } }));
    patientApi.defaults.adapter = async (config) => {
      throw failure(config, 401);
    };
    await expect(patientApi.get('/patient-api/me')).rejects.toBeDefined();
    expect(wipePatientPersistedCache).toHaveBeenCalledTimes(1);
    expect(await getRefreshToken()).toBeNull();
    expect(usePatientAuthStore.getState().status).toBe('signedOut');
  });

  it('a network failure keeps the session (no wipe, token kept, no automatic retry)', async () => {
    const post = jest.spyOn(axios, 'post').mockRejectedValue(new Error('Network Error'));
    await expect(refreshSession()).rejects.toThrow('Network Error');
    expect(post).toHaveBeenCalledTimes(1);
    expect(wipePatientPersistedCache).not.toHaveBeenCalled();
    expect(await getRefreshToken()).toBe('session:token-1');
  });

  it('never refreshes for /patient-auth/* endpoints', async () => {
    const post = jest.spyOn(axios, 'post');
    patientApi.defaults.adapter = async (config) => {
      throw failure(config, 401);
    };
    await expect(patientApi.post('/patient-auth/email/verify', {})).rejects.toBeDefined();
    expect(post).not.toHaveBeenCalled();
  });
});
