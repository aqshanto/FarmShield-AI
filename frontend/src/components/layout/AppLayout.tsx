import { AnimatePresence, motion } from 'framer-motion'
import { Home, LayoutDashboard, Map as MapIcon, MessageCircle, Satellite, ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useMatches, useNavigation } from 'react-router-dom'
import { prefetchPage, prefetchWhenIdle } from '@/app/routes'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import { Starfield } from './Starfield'

// On phones the nav shows icons only (labels stay available to screen readers).
const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/map', label: 'Map', icon: MapIcon },
  { to: '/assistant', label: 'Assistant', icon: MessageCircle },
  { to: '/data', label: 'Data', icon: Satellite },
]

/** The deepest route's `handle.title`, e.g. "Risk map · FarmShield AI". */
function useDocumentTitle() {
  const matches = useMatches()
  const title = [...matches].reverse().map((m) => (m.handle as { title?: string } | undefined)?.title).find(Boolean)
  useEffect(() => {
    document.title = title ? `${title} · FarmShield AI` : 'FarmShield AI'
  }, [title])
}

/** A slim glowing bar while the next page's code or data loads. */
function NavigationProgress() {
  const busy = useNavigation().state !== 'idle'
  return (
    <AnimatePresence>
      {busy && (
        <motion.div
          role="progressbar"
          aria-label="Loading page"
          className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-sky-300 via-leaf-300 to-leaf-500 shadow-glow-leaf"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 0.85, transition: { duration: 2.5, ease: [0.1, 0.8, 0.2, 1] } }}
          exit={{ scaleX: 1, opacity: 0, transition: { duration: 0.35 } }}
        />
      )}
    </AnimatePresence>
  )
}

export function AppLayout() {
  const location = useLocation()
  useDocumentTitle()
  // The map is heavy (WebGL engine), so it only loads on intent; the rest warms up when idle.
  useEffect(() => prefetchWhenIdle(['/dashboard', '/assistant', '/data']), [])

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-[radial-gradient(ellipse_at_top,var(--color-night-800)_0%,var(--color-night-950)_60%)]">
      {/* New pages open at the top; back/forward restores the previous position. */}
      <ScrollRestoration />
      <NavigationProgress />
      <Starfield />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link to="/" className="focus-ring group flex items-center gap-2 rounded-xl font-bold tracking-tight text-ink">
          <motion.span
            whileHover={{ rotate: -8, scale: 1.08 }}
            transition={spring.bouncy}
            className="grid size-9 place-items-center rounded-xl bg-gradient-to-b from-leaf-400 to-leaf-600 text-night-950 shadow-glow-leaf"
          >
            <ShieldCheck className="size-5" />
          </motion.span>
          <span className="hidden sm:inline">FarmShield AI</span>
        </Link>

        <nav aria-label="Main" className="glass flex rounded-full p-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onPointerEnter={() => prefetchPage(item.to)}
              onFocus={() => prefetchPage(item.to)}
              className={({ isActive }) =>
                cn(
                  'focus-ring relative rounded-full px-3 py-2 text-sm font-semibold transition-colors sm:px-3.5 sm:py-1.5 lg:px-4',
                  isActive ? 'text-night-950' : 'text-ink-muted hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      transition={spring.snappy}
                      className="absolute inset-0 rounded-full bg-gradient-to-b from-leaf-300 to-leaf-500"
                    />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    <item.icon className="size-4 sm:hidden" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">{item.label}</span>
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        {/* Keyed on the path so every page enters with the same soft rise. */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.gentle}
        >
          <Outlet />
        </motion.div>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 text-xs text-ink-subtle sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Powered by NASA Earth observation data · SMAP · GPM · MODIS · VIIRS</span>
          <Link to="/design" className="focus-ring rounded hover:text-ink-muted">
            Design system
          </Link>
        </div>
      </footer>
    </div>
  )
}
