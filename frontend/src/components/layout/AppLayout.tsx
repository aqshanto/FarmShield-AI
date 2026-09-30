import { motion } from 'framer-motion'
import { Home, LayoutDashboard, Map as MapIcon, Palette, Satellite, ShieldCheck } from 'lucide-react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import { Starfield } from './Starfield'

// On phones the nav shows icons only (labels stay available to screen readers).
const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/map', label: 'Map', icon: MapIcon },
  { to: '/data', label: 'Data', icon: Satellite },
  { to: '/design', label: 'Design', icon: Palette },
]

export function AppLayout() {
  const location = useLocation()

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-[radial-gradient(ellipse_at_top,var(--color-night-800)_0%,var(--color-night-950)_60%)]">
      {/* New pages open at the top; back/forward restores the previous position. */}
      <ScrollRestoration />
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
        Powered by NASA Earth observation data · SMAP · GPM · MODIS · VIIRS
      </footer>
    </div>
  )
}
