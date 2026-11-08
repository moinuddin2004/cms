/**
 * `clinic://` links on the desktop shell.
 *
 * The Google sign-in page runs in the system browser (Google refuses its
 * popup inside an embedded webview) and comes back to the app through a
 * custom protocol. On Windows the OS starts a second instance for the link;
 * `tauri-plugin-single-instance` forwards it to the running one, which the
 * deep-link plugin then hands to the webview as an event.
 *
 * Everything here is a no-op in a browser: the Tauri plugins are imported
 * dynamically so they never reach the web bundle's initial chunks.
 */

import { isDesktop } from './desktop-session'

/** The scheme registered in `tauri.conf.json > plugins.deep-link`. */
export const DESKTOP_PROTOCOL = 'clinic'
const LINK_PREFIX = `${DESKTOP_PROTOCOL}://`
const URL_EVENT = 'clinic-desktop-url'

/** A link that arrived before any listener existed (cold start). */
let pending: string | null = null
let started = false

function deliver(urls: string[] | null | undefined) {
  for (const url of urls ?? []) {
    if (!url.startsWith(LINK_PREFIX)) continue
    pending = url
    window.dispatchEvent(new CustomEvent<string>(URL_EVENT, { detail: url }))
  }
}

/**
 * Listen for `clinic://` links. If a link is already waiting (the app was
 * launched by it), the listener is called right away.
 */
export function onDesktopLink(listener: (url: string) => void): () => void {
  const handler = (event: Event) =>
    listener((event as CustomEvent<string>).detail)
  window.addEventListener(URL_EVENT, handler)
  if (pending) {
    const url = pending
    pending = null
    listener(url)
  }
  return () => window.removeEventListener(URL_EVENT, handler)
}

/** Subscribe once, from the root component, on desktop only. */
export async function initDesktopLinks(): Promise<void> {
  if (!isDesktop() || started) return
  started = true
  try {
    const { getCurrent, onOpenUrl } = await import(
      '@tauri-apps/plugin-deep-link'
    )
    deliver(await getCurrent())
    await onOpenUrl((urls) => deliver(urls))
  } catch {
    // Plugin missing (web build or an older shell): links simply never fire.
    started = false
  }
}
