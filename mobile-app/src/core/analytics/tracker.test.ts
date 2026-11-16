import { createTracker } from './tracker';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const opts = { enabled: true, flushDelayMs: 1000 };

describe('createTracker', () => {
  it('batches events and sends them after the delay', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const t = createTracker<string>({ ...opts, send });
    t.track('a');
    t.track('b', { kind: 'visits' });
    expect(send).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].map((e: { name: string }) => e.name)).toEqual(['a', 'b']);
    expect(send.mock.calls[0][0][1].props).toEqual({ kind: 'visits' });
  });

  it('keeps the batch and retries with backoff when offline', async () => {
    const send = jest.fn().mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue(undefined);
    const t = createTracker<string>({ ...opts, send });
    t.track('a');
    await jest.advanceTimersByTimeAsync(1000);
    expect(send).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(2000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toHaveLength(1);
  });

  it('drops a batch the server rejects (4xx) but retries 429', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockResolvedValue(undefined);
    const t = createTracker<string>({ ...opts, send });
    t.track('a');
    await jest.advanceTimersByTimeAsync(1000);
    expect(send).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(send).toHaveBeenCalledTimes(1); // dropped, nothing left
    t.track('b');
    await jest.advanceTimersByTimeAsync(1000);
    expect(send).toHaveBeenCalledTimes(2); // 429 → kept
    await jest.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('caps the queue and the batch size', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const t = createTracker<string>({ ...opts, send, maxQueue: 5, maxBatch: 3 });
    for (let i = 0; i < 8; i++) t.track(`e${i}`);
    await t.flush();
    expect(send.mock.calls[0][0].map((e: { name: string }) => e.name)).toEqual(['e3', 'e4', 'e5']);
  });

  it('never throws and clear() forgets the queue', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const t = createTracker<string>({ ...opts, send });
    t.track('a');
    t.clear();
    await jest.advanceTimersByTimeAsync(5000);
    expect(send).not.toHaveBeenCalled();
  });

  it('is a no-op when disabled (the default under Jest)', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const t = createTracker<string>({ send });
    t.track('a');
    await t.flush();
    jest.advanceTimersByTime(60_000);
    expect(send).not.toHaveBeenCalled();
  });
});
