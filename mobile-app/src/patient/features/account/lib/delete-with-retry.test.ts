import { AxiosError } from 'axios';

import { deleteWithRetry } from './delete-with-retry';

const networkError = () => new AxiosError('Network Error', 'ERR_NETWORK');
const httpError = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, { status } as never);

describe('deleteWithRetry', () => {
  it('a first success calls once', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    await deleteWithRetry(call);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('retries once after a network error and succeeds', async () => {
    const call = jest.fn().mockRejectedValueOnce(networkError()).mockResolvedValueOnce(undefined);
    await deleteWithRetry(call);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it.each([401, 404])('a %i on the retry means the first call worked → success', async (status) => {
    const call = jest.fn().mockRejectedValueOnce(networkError()).mockRejectedValueOnce(httpError(status));
    await expect(deleteWithRetry(call)).resolves.toBeUndefined();
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('two network errors in a row fail', async () => {
    const call = jest.fn().mockRejectedValue(networkError());
    await expect(deleteWithRetry(call)).rejects.toBeDefined();
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('a server error on the retry fails', async () => {
    const call = jest.fn().mockRejectedValueOnce(networkError()).mockRejectedValueOnce(httpError(500));
    await expect(deleteWithRetry(call)).rejects.toBeDefined();
  });

  it('a 401 / 404 on the FIRST call is not treated as success (no retry, thrown)', async () => {
    const call = jest.fn().mockRejectedValue(httpError(404));
    await expect(deleteWithRetry(call)).rejects.toBeDefined();
    expect(call).toHaveBeenCalledTimes(1);
  });
});
