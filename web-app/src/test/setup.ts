/* eslint-disable @typescript-eslint/no-unnecessary-condition -- DOM typings say these always exist; jsdom doesn't implement them. */
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom lacks these; Radix UI (Select, Dialog, Tooltip) touches them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??=
  ResizeObserverStub as unknown as typeof ResizeObserver
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.scrollIntoView ??= () => {}
window.matchMedia ??= ((q: string) => ({
  matches: false,
  media: q,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia

afterEach(() => cleanup())
