import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom does not implement scrolling; animation libraries and the dashboard call these.
window.scrollTo = () => {}
Element.prototype.scrollIntoView = () => {}

// jsdom has no IntersectionObserver; treat every observed element as visible so
// scroll-triggered animations (whileInView, useInView) run in tests.
class MockIntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = [0]
  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    const entry = { isIntersecting: true, intersectionRatio: 1, target } as IntersectionObserverEntry
    this.callback([entry], this as unknown as IntersectionObserver)
  }

  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
