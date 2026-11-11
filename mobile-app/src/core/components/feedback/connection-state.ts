/** What the realtime pill shows (docs/05 §7). */
export type ConnectionState = 'live' | 'reconnecting' | 'offline';

/**
 * Pure rule behind `ConnectionPill`. Core cannot read a space's socket, so the
 * space passes its two facts in: the phone network (`core/network`) and
 * whether its realtime socket is connected.
 */
export function deriveConnectionState(input: {
  online: boolean;
  realtimeConnected: boolean;
}): ConnectionState {
  if (!input.online) return 'offline';
  return input.realtimeConnected ? 'live' : 'reconnecting';
}
