/* eslint-disable @typescript-eslint/no-unnecessary-condition -- DOM typings say these always exist; jsdom doesn't implement them. */
import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

// The full suite runs files in parallel; under that load heavy pages (role
// detail, …) and jsdom's *ByRole queries can take past Testing Library's 1 s
// default before content appears. Waits only — every assertion is unchanged.
configure({ asyncUtilTimeout: 5_000 })

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
