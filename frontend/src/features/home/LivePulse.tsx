import { motion } from 'framer-motion'
import { Grid3x3, Satellite, ShieldCheck, Tractor } from 'lucide-react'
import type { ReactNode } from 'react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { fadeUp, stagger } from '@/lib/motion'
import type { MapOverview } from '@/types/api'

function Stat({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <motion.div variants={fadeUp} className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-leaf-500/15 text-leaf-300 ring-1 ring-leaf-400/25">{icon}</span>
      <span>
        <span className="block text-2xl font-extrabold leading-none text-ink">{value}</span>
        <span className="text-xs text-ink-muted">{label}</span>
      </span>
    </motion.div>
  )
}

// Numbers that are true right now: what FarmShield is watching today.
export function LivePulse({ overview }: { overview?: MapOverview }) {
  const live = overview?.data_mode === 'live' && overview.layers.some((l) => l.live)
  return (
    <motion.section
      aria-label="FarmShield today"
      variants={stagger(0.08)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      className="glass grid grid-cols-2 gap-5 rounded-3xl p-5 sm:p-6 lg:grid-cols-4"
    >
      <Stat icon={<Satellite className="size-5" aria-hidden="true" />} value={<AnimatedNumber value={4} />} label="NASA missions: SMAP, GPM, MODIS, VIIRS" />
      <Stat
        icon={<Grid3x3 className="size-5" aria-hidden="true" />}
        value={overview ? <AnimatedNumber value={overview.cells.length} /> : '—'}
        label="land areas checked across Bangladesh"
      />
      <Stat
        icon={<Tractor className="size-5" aria-hidden="true" />}
        value={overview ? <AnimatedNumber value={overview.farms.length} /> : '—'}
        label={live ? 'farms watched with live data' : 'demo farms'}
      />
      <Stat icon={<ShieldCheck className="size-5" aria-hidden="true" />} value={<AnimatedNumber value={3} />} label="early warnings: flood, water, crop" />
    </motion.section>
  )
}
