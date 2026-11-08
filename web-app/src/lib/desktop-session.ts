/**
 * Desktop (Tauri) session storage.
 *
 * A browser keeps the refresh token in an httpOnly cookie. A Tauri webview
 * cannot read or send a cookie that belongs to the API's origin, so the
 * desktop build keeps the same `sessionId:refreshToken` value in the app's
 * data directory and sends it back in the `x-refresh-token` header — the
 * contract the mobile app already uses (`backend/src/auth/native-client.ts`).
 *
 * Everything here is a no-op in a browser, and the Tauri plugin is imported
 * dynamically so it never reaches the web bundle.
 */

import type { LazyStore } from '@tauri-apps/plugin-store'

const STORE_FILE = 'session.json'
const REFRESH_TOKEN_KEY = 'refreshToken'

/** True when the app is running inside the Tauri desktop shell. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

let storePromise: Promise<LazyStore> | null = null

function sessionStore(): Promise<LazyStore> {
  storePromise ??= import('@tauri-apps/plugin-store').then(
    ({ LazyStore }) => new LazyStore(STORE_FILE, { autoSave: true }),
  )
  return storePromise
}

/** Persist a rotated refresh token. Silently ignored in a browser. */
export async function saveRefreshToken(token: unknown): Promise<void> {
  if (!isDesktop() || typeof token !== 'string' || !token) return
  try {
    const store = await sessionStore()
    await store.set(REFRESH_TOKEN_KEY, token)
    await store.save()
  } catch {
    // Storage is a convenience: the in-memory session keeps working.
  }
}

/** The stored refresh token, or null in a browser / when none is stored. */
export async function getRefreshToken(): Promise<string | null> {
  if (!isDesktop()) return null
  try {
    const store = await sessionStore()
    const value = await store.get<string>(REFRESH_TOKEN_KEY)
    return typeof value === 'string' && value ? value : null
  } catch {
    return null
  }
}

/** Forget the stored refresh token (sign-out / invalid session). */
export async function clearRefreshToken(): Promise<void> {
  if (!isDesktop()) return
  try {
    const store = await sessionStore()
    await store.delete(REFRESH_TOKEN_KEY)
    await store.save()
  } catch {
    // Nothing to clear.
  }
}
