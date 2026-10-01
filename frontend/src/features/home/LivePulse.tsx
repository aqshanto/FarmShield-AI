import { motion } from 'framer-motion'
import { Grid3x3, Satellite, ShieldCheck, Tractor } from 'lucide-react'
import type { ReactNode } from 'react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { numberLocale, useLang, useText } from '@/lib/i18n'
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

const text = {
  en: {
    region: 'FarmShield today',
    missions: 'NASA missions: SMAP, GPM, MODIS, VIIRS',
    areas: 'land areas checked across Bangladesh',
    liveFarms: 'farms watched with live data',
    demoFarms: 'demo farms',
    warnings: 'early warnings: flood, water, crop',
  },
  bn: {
    region: 'আজ ফার্মশিল্ড',
    missions: 'নাসার মিশন: SMAP, GPM, MODIS, VIIRS',
    areas: 'বাংলাদেশজুড়ে জমির এলাকা পরীক্ষা করা হয়েছে',
    liveFarms: 'খামারে লাইভ তথ্য দিয়ে নজর রাখা হচ্ছে',
    demoFarms: 'ডেমো খামার',
    warnings: 'আগাম সতর্কতা: বন্যা, পানি, ফসল',
  },
}

// Numbers that are true right now: what FarmShield is watching today.
export function LivePulse({ overview }: { overview?: MapOverview }) {
  const live = overview?.data_mode === 'live' && overview.layers.some((l) => l.live)
  const lang = useLang()
  const t = useText(text)
  const locale = numberLocale[lang]
  return (
    <motion.section
      aria-label={t.region}
      variants={stagger(0.08)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      className="glass grid grid-cols-2 gap-5 rounded-3xl p-5 sm:p-6 lg:grid-cols-4"
    >
      <Stat icon={<Satellite className="size-5" aria-hidden="true" />} value={<AnimatedNumber value={4} locale={locale} />} label={t.missions} />
      <Stat
        icon={<Grid3x3 className="size-5" aria-hidden="true" />}
        value={overview ? <AnimatedNumber value={overview.cells.length} locale={locale} /> : '—'}
        label={t.areas}
      />
      <Stat
        icon={<Tractor className="size-5" aria-hidden="true" />}
        value={overview ? <AnimatedNumber value={overview.farms.length} locale={locale} /> : '—'}
        label={live ? t.liveFarms : t.demoFarms}
      />
      <Stat icon={<ShieldCheck className="size-5" aria-hidden="true" />} value={<AnimatedNumber value={3} locale={locale} />} label={t.warnings} />
    </motion.section>
  )
}
