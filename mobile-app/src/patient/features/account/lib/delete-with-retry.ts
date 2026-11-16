import { isAxiosError } from 'axios';

/** No response at all: the request may or may not have reached the server. */
const isNetworkError = (err: unknown): boolean => isAxiosError(err) && !err.response;

/** The account is already gone: the session is dead (401) or the account is not found (404). */
const isAlreadyDeleted = (err: unknown): boolean => {
  const status = isAxiosError(err) ? err.response?.status : undefined;
  return status === 401 || status === 404;
};

/**
 * Run the delete call. A network failure may hide a delete that DID happen
 * (response lost), so it is retried once; on that retry a 401 / 404 means the
 * first call worked, which counts as success so the phone is still wiped.
 * Any other failure, or a second network failure, is thrown and nothing local
 * is touched.
 */
export async function deleteWithRetry(call: () => Promise<void>): Promise<void> {
  try {
    await call();
    return;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
  }
  try {
    await call();
  } catch (err) {
    if (!isAlreadyDeleted(err)) throw err;
  }
}
