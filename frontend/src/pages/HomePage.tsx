import { motion } from 'framer-motion'
import { ChevronDown, LayoutDashboard, Map as MapIcon, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { buttonStyles } from '@/components/ui/button-styles'
import { HowItWorks } from '@/features/home/HowItWorks'
import { LiveFarms } from '@/features/home/LiveFarms'
import { LivePulse } from '@/features/home/LivePulse'
import { OrbitIllustration } from '@/features/home/OrbitIllustration'
import { api } from '@/lib/api'
import { fadeUp, stagger } from '@/lib/motion'
import { useAsync } from '@/lib/useAsync'

export function HomePage() {
  const overview = useAsync('map-overview', (signal) => api.mapOverview({ signal }), { retries: 5 })
  const data = overview.data
  const live = data?.data_mode === 'live' && data.layers.some((l) => l.live)

  return (
    <div className="space-y-20 pb-12 sm:space-y-28">
      {/* Hero */}
      <section className="grid items-center gap-10 pt-6 lg:min-h-[calc(100svh-11rem)] lg:grid-cols-2 lg:pt-0">
        <motion.div variants={stagger(0.1)} initial="hidden" animate="show" className="space-y-6">
          <motion.div variants={fadeUp}>
            <Badge tone="leaf">NASA Space Apps Challenge</Badge>
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-5xl font-extrabold tracking-tight sm:text-display">
            <span className="text-gradient-brand">FarmShield AI</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="text-2xl font-bold text-ink sm:text-3xl">
            Satellite eyes for every farm.
          </motion.p>
          <motion.p variants={fadeUp} lang="bn" className="text-lg text-ink-muted">
            প্রতিটি খামারের জন্য স্যাটেলাইটের চোখ।
          </motion.p>
          <motion.p variants={fadeUp} className="max-w-lg text-ink-muted">
            FarmShield turns NASA satellite data into early, simple warnings about floods, dry soil and crop stress, so
            farmers in Bangladesh know what to do today, in Bengali or English.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
            <Link to="/dashboard" className={buttonStyles({ size: 'lg' })}>
              <LayoutDashboard className="size-5" aria-hidden="true" />
              See a live farm
            </Link>
            <Link to="/assistant" className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
              <MessageCircle className="size-5" aria-hidden="true" />
              Ask in <span lang="bn">বাংলা</span>
            </Link>
            <Link to="/map" className={buttonStyles({ variant: 'ghost', size: 'lg' })}>
              <MapIcon className="size-5" aria-hidden="true" />
              Explore the map
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
          className="order-first lg:order-none"
        >
          <OrbitIllustration />
        </motion.div>

        <motion.a
          href="#how-it-works"
          onClick={(e) => {
            e.preventDefault()
            document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 6, 0] }}
          transition={{ opacity: { delay: 1.2 }, y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } }}
          className="focus-ring mx-auto hidden items-center gap-1 rounded-full px-3 py-1 text-sm text-ink-subtle hover:text-ink lg:col-span-2 lg:flex"
        >
          How it works <ChevronDown className="size-4" aria-hidden="true" />
        </motion.a>
      </section>

      <LivePulse overview={data} />
      <HowItWorks />
      <LiveFarms farms={data?.farms} live={live} failed={overview.status === 'error' && !data} />

      {/* Closing call to action */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={stagger(0.1)}
        className="glass relative overflow-hidden rounded-3xl px-6 py-12 text-center"
      >
        <div aria-hidden="true" className="absolute -bottom-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-leaf-500/15 blur-3xl" />
        <motion.h2 variants={fadeUp} className="relative text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Warnings that arrive before the water does.
        </motion.h2>
        <motion.p variants={fadeUp} className="relative mx-auto mt-3 max-w-xl text-ink-muted">
          Built on free, open NASA data, so it can grow to every district without new sensors in the field.
        </motion.p>
        <motion.div variants={fadeUp} className="relative mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/dashboard" className={buttonStyles({ size: 'lg' })}>
            <LayoutDashboard className="size-5" aria-hidden="true" />
            Open the dashboard
          </Link>
          <Link to="/data" className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
            See the NASA data
          </Link>
        </motion.div>
      </motion.section>
    </div>
  )
}
