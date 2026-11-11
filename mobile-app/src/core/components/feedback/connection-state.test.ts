import { deriveConnectionState } from './connection-state';

describe('deriveConnectionState', () => {
  it('is offline whenever the phone is offline', () => {
    expect(deriveConnectionState({ online: false, realtimeConnected: true })).toBe('offline');
    expect(deriveConnectionState({ online: false, realtimeConnected: false })).toBe('offline');
  });

  it('is reconnecting when online but the socket is down, live when both are up', () => {
    expect(deriveConnectionState({ online: true, realtimeConnected: false })).toBe('reconnecting');
    expect(deriveConnectionState({ online: true, realtimeConnected: true })).toBe('live');
  });
});
