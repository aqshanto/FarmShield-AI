// Lazy page loaders, shared by the router and by link prefetching so a page's code is
// fetched once whether the farmer hovers its link first or clicks straight away.
export const pageLoaders = {
  '/dashboard': () => import('@/pages/DashboardPage').then((m) => m.DashboardPage),
  '/map': () => import('@/pages/MapPage').then((m) => m.MapPage),
  '/assistant': () => import('@/pages/AssistantPage').then((m) => m.AssistantPage),
  '/data': () => import('@/pages/DataPage').then((m) => m.DataPage),
  '/design': () => import('@/pages/DesignSystemPage').then((m) => m.DesignSystemPage),
} as const

export type LazyPath = keyof typeof pageLoaders

const started = new Set<string>()

/** Starts downloading a page's code (no-op for unknown paths or ones already fetched). */
export function prefetchPage(path: string) {
  const pathname = path.split('?')[0] as LazyPath
  const load = pageLoaders[pathname]
  if (!load || started.has(pathname)) return
  started.add(pathname)
  load().catch(() => started.delete(pathname)) // retry on the next hover if offline
}

/** Once the first page is idle, warm the light pages so later clicks feel instant. */
export function prefetchWhenIdle(paths: LazyPath[]) {
  const run = () => paths.forEach(prefetchPage)
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 2000)
}
