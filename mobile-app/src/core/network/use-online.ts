/**
 * Online state for the phone (card M1-06a). `useOnline` is for components;
 * `isOnlineNow` reads the same signal for non-React code. Both treat an
 * unknown state (`isConnected === null`) as online so we never lock the UI
 * before NetInfo has answered.
 */
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

let lastKnown = true;

export function isOnlineNow(): boolean {
  return lastKnown;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(lastKnown);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      lastKnown = state.isConnected !== false;
      setOnline(lastKnown);
    });
    return unsubscribe;
  }, []);

  return online;
}
