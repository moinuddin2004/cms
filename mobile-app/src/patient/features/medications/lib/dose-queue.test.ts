import { postDoseEvents } from '../api/medications.api';
import { chunk, flushDoseQueue, removeSent, upsertQueued, useDoseQueueStore } from './dose-queue';
import { at, event } from './test-fixtures';

jest.mock('../api/medications.api', () => ({ postDoseEvents: jest.fn() }));
const post = postDoseEvents as jest.MockedFunction<typeof postDoseEvents>;

const httpError = (status: number) => Object.assign(new Error('http'), { isAxiosError: true, response: { status } });
const D1 = at(2026, 11, 16, 8);
const D2 = at(2026, 11, 16, 20);

describe('queue helpers', () => {
  it('upsert keeps one event per dose, the newest wins', () => {
    const a = event('s', D1, 'taken', 1000);
    const b = event('s', D1, 'skipped', 2000);
    expect(upsertQueued([a], b)).toEqual([b]);
    expect(upsertQueued([b], a)).toEqual([b]);
  });

  it('removeSent keeps an event changed while the request was in flight', () => {
    const sent = event('s', D1, 'taken', 1000);
    const changed = event('s', D1, 'skipped', 2000);
    expect(removeSent([changed], [sent])).toEqual([changed]);
    expect(removeSent([sent], [sent])).toEqual([]);
  });

  it('chunk splits into batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe('flushDoseQueue', () => {
  beforeEach(async () => {
    post.mockReset();
    useDoseQueueStore.getState().reset();
    await useDoseQueueStore.getState().hydrate('acc-1');
  });

  it('is saved locally first, then sent and cleared', async () => {
    useDoseQueueStore.getState().enqueue(event('s', D1));
    expect(useDoseQueueStore.getState().items).toHaveLength(1);
    post.mockResolvedValue(1);
    expect(await flushDoseQueue()).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    expect(useDoseQueueStore.getState().items).toEqual([]);
  });

  it('keeps everything while offline (no response) and sends after reconnect', async () => {
    useDoseQueueStore.getState().enqueue(event('s', D1));
    useDoseQueueStore.getState().enqueue(event('s', D2, 'skipped'));
    post.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true }));
    expect(await flushDoseQueue()).toBe(false);
    expect(useDoseQueueStore.getState().items).toHaveLength(2);
    post.mockResolvedValue(2);
    expect(await flushDoseQueue()).toBe(true);
    expect(post).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ action: 'skipped' })]));
    expect(useDoseQueueStore.getState().items).toEqual([]);
  });

  it('keeps events on a server error', async () => {
    useDoseQueueStore.getState().enqueue(event('s', D1));
    post.mockRejectedValue(httpError(503));
    await flushDoseQueue();
    expect(useDoseQueueStore.getState().items).toHaveLength(1);
  });

  it('a rejected batch is retried one by one and only the bad event is dropped', async () => {
    useDoseQueueStore.getState().enqueue(event('good', D1));
    useDoseQueueStore.getState().enqueue(event('bad', D2));
    post.mockImplementation(async (events) => {
      if (events.length > 1 || events[0].scheduleId === 'bad') throw httpError(404);
      return 1;
    });
    expect(await flushDoseQueue()).toBe(true);
    expect(useDoseQueueStore.getState().items).toEqual([]);
  });

  it('ignores enqueue before an account is known and after reset', () => {
    useDoseQueueStore.getState().reset();
    useDoseQueueStore.getState().enqueue(event('s', D1));
    expect(useDoseQueueStore.getState().items).toEqual([]);
  });

  it('survives an app restart: a new store reads the encrypted copy', async () => {
    useDoseQueueStore.getState().enqueue(event('s', D1));
    await new Promise((r) => setTimeout(r, 0));
    useDoseQueueStore.getState().reset();
    await useDoseQueueStore.getState().hydrate('acc-1');
    expect(useDoseQueueStore.getState().items).toHaveLength(1);
    useDoseQueueStore.getState().remove(useDoseQueueStore.getState().items);
  });
});
