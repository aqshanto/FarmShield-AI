import { motion } from 'framer-motion'
import { LayoutDashboard, Palette } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { buttonStyles } from '@/components/ui/button-styles'
import { OrbitIllustration } from '@/features/system-status/OrbitIllustration'
import { SystemStatusPanel } from '@/features/system-status/SystemStatusPanel'
import { fadeUp, stagger } from '@/lib/motion'

export function HomePage() {
  return (
    <div className="grid items-center gap-10 py-8 lg:grid-cols-2 lg:py-16">
      <div className="space-y-8">
        <motion.div variants={stagger(0.1)} initial="hidden" animate="show" className="space-y-4">
          <motion.div variants={fadeUp}>
            <Badge tone="leaf">NASA Space Apps Challenge</Badge>
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-5xl font-extrabold tracking-tight sm:text-display">
            <span className="text-gradient-brand">FarmShield AI</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="max-w-md text-lg text-ink-muted">
            Satellite eyes for every farm.
          </motion.p>
          <motion.p variants={fadeUp} lang="bn" className="max-w-md text-base text-ink-subtle">
            প্রতিটি খামারের জন্য স্যাটেলাইটের চোখ।
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
            <Link to="/dashboard" className={buttonStyles()}>
              <LayoutDashboard className="size-4" aria-hidden="true" />
              Open farm dashboard
            </Link>
            <Link to="/design" className={buttonStyles({ variant: 'secondary' })}>
              <Palette className="size-4" aria-hidden="true" />
              Design system
            </Link>
          </motion.div>
        </motion.div>

        <SystemStatusPanel />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
        className="order-first lg:order-last"
      >
        <OrbitIllustration />
      </motion.div>
    </div>
  )
}
