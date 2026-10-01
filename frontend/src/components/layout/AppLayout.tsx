import { AnimatePresence, motion } from 'framer-motion'
import { Home, Languages, LayoutDashboard, Map as MapIcon, MessageCircle, Satellite, ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useMatches, useNavigation } from 'react-router-dom'
import { prefetchPage, prefetchWhenIdle } from '@/app/routes'
import { cn } from '@/lib/cn'
import { type Lang, setLang, useLang, useText } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { Starfield } from './Starfield'

const text = {
  en: {
    nav: { '/': 'Home', '/dashboard': 'Dashboard', '/map': 'Map', '/assistant': 'Assistant', '/data': 'Data' },
    navLabel: 'Main',
    loading: 'Loading page',
    switchTo: 'বাংলা',
    switchLabel: 'বাংলায় দেখুন (switch to Bengali)',
    poweredBy: 'Powered by NASA Earth observation data',
    design: 'Design system',
  },
  bn: {
    nav: { '/': 'হোম', '/dashboard': 'ড্যাশবোর্ড', '/map': 'মানচিত্র', '/assistant': 'সহকারী', '/data': 'তথ্য' },
    navLabel: 'প্রধান মেনু',
    loading: 'পাতা লোড হচ্ছে',
    switchTo: 'EN',
    switchLabel: 'Switch to English (ইংরেজিতে দেখুন)',
    poweredBy: 'নাসার পৃথিবী পর্যবেক্ষণ তথ্যের সাহায্যে',
    design: 'ডিজাইন সিস্টেম',
  },
}

// On phones the nav shows icons only (labels stay available to screen readers).
const navItems = [
  { to: '/', icon: Home },
  { to: '/dashboard', icon: LayoutDashboard },
  { to: '/map', icon: MapIcon },
  { to: '/assistant', icon: MessageCircle },
  { to: '/data', icon: Satellite },
] as const

export type RouteTitle = Record<Lang, string>

/** The deepest route's `handle.title` in the farmer's language, e.g. "Risk map · FarmShield AI". */
function useDocumentTitle() {
  const matches = useMatches()
  const lang = useLang()
  const title = [...matches].reverse().map((m) => (m.handle as { title?: RouteTitle } | undefined)?.title?.[lang]).find(Boolean)
  useEffect(() => {
    document.title = title ? `${title} · FarmShield AI` : 'FarmShield AI'
  }, [title])
}

/** One tap switches every screen between English and Bengali. */
function LanguageSwitch() {
  const lang = useLang()
  const t = useText(text)
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
      aria-label={t.switchLabel}
      lang={lang === 'en' ? 'bn' : 'en'}
      className="focus-ring glass inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-bold text-leaf-200 transition hover:text-leaf-100"
    >
      <Languages className="size-4" aria-hidden="true" />
      {t.switchTo}
    </motion.button>
  )
}

/** A slim glowing bar while the next page's code or data loads. */
function NavigationProgress() {
  const busy = useNavigation().state !== 'idle'
  const t = useText(text)
  return (
    <AnimatePresence>
      {busy && (
        <motion.div
          role="progressbar"
          aria-label={t.loading}
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
  const t = useText(text)
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

        <div className="flex items-center gap-2">
        <LanguageSwitch />
        <nav aria-label={t.navLabel} className="glass flex rounded-full p-1">
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
                    <span className="sr-only sm:not-sr-only">{t.nav[item.to]}</span>
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        </div>
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
          <span>{t.poweredBy} · SMAP · GPM · MODIS · VIIRS</span>
          <Link to="/design" className="focus-ring rounded hover:text-ink-muted">
            {t.design}
          </Link>
        </div>
      </footer>
    </div>
  )
}
