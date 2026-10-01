import { motion } from 'framer-motion'
import { Home, RotateCw } from 'lucide-react'
import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { buttonStyles } from '@/components/ui/button-styles'
import { Starfield } from '@/components/layout/Starfield'
import { useText } from '@/lib/i18n'

// Shown instead of a crash screen when a page fails to render or its code can't load
// (for example after a new deploy, or on a dropped connection).
const text = {
  en: {
    docTitle: 'Something went wrong · FarmShield AI',
    notFound: 'This field is off the map',
    lost: 'We lost the signal for a moment',
    notFoundBody: 'Our satellites could not find that page.',
    lostBody: 'Something went wrong while loading this page. Reloading usually brings it back.',
    reload: 'Reload',
    home: 'Home',
  },
  bn: {
    docTitle: 'কিছু একটা সমস্যা হয়েছে · ফার্মশিল্ড এআই',
    notFound: 'এই জমি মানচিত্রে নেই',
    lost: 'কিছুক্ষণের জন্য সংযোগ হারিয়েছি',
    notFoundBody: 'আমাদের উপগ্রহ পাতাটি খুঁজে পায়নি।',
    lostBody: 'পাতাটি লোড করতে সমস্যা হয়েছে। আবার লোড করলে সাধারণত ঠিক হয়ে যায়।',
    reload: 'আবার লোড করুন',
    home: 'হোম',
  },
}

export function RouteErrorPage() {
  const error = useRouteError()
  const t = useText(text)
  useEffect(() => {
    console.error('Page error', error)
    document.title = t.docTitle
  }, [error, t.docTitle])
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <div className="relative grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,var(--color-night-800)_0%,var(--color-night-950)_60%)] px-4">
      <Starfield />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex max-w-md flex-col items-center gap-4 text-center"
      >
        <motion.p
          className="text-6xl"
          animate={{ rotate: [0, -8, 8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          🛰️
        </motion.p>
        <h1 className="text-2xl font-bold text-ink">{notFound ? t.notFound : t.lost}</h1>
        <p className="text-ink-muted">{notFound ? t.notFoundBody : t.lostBody}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className={buttonStyles()}>
            <RotateCw className="size-4" aria-hidden="true" /> {t.reload}
          </button>
          <a href="/" className={buttonStyles({ variant: 'secondary' })}>
            <Home className="size-4" aria-hidden="true" /> {t.home}
          </a>
        </div>
      </motion.div>
    </div>
  )
}
