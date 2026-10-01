import { motion } from 'framer-motion'
import { ArrowRight, MapPin, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { Skeleton } from '@/components/ui/Skeleton'
import { moduleVisuals } from '@/features/dashboard/module-visuals'
import { useLang, useText } from '@/lib/i18n'
import { fadeUp, stagger } from '@/lib/motion'
import { levelLabel, riskMeta } from '@/lib/risk'
import type { MapFarm, RiskModule } from '@/types/api'

const text = {
  en: {
    modules: { flood_risk: 'Flood', water_stress: 'Water', crop_health: 'Crop' } as Record<RiskModule, string>,
    risks: (name: string) => `${name} risks`,
    open: 'Open farm',
    ask: 'Ask',
    eyebrowLive: 'Live right now',
    eyebrowDemo: 'Demo farms',
    title: 'Three farms, three different stories',
    intro: 'A flood-prone wetland, a drought-prone plateau and a river-plain potato field,',
    live: 'each read from today’s satellite data.',
    demo: 'shown with a demo scenario.',
    loading: 'Loading farms',
  },
  bn: {
    modules: { flood_risk: 'বন্যা', water_stress: 'পানি', crop_health: 'ফসল' } as Record<RiskModule, string>,
    risks: (name: string) => `${name}: ঝুঁকি`,
    open: 'খামার খুলুন',
    ask: 'জিজ্ঞেস করুন',
    eyebrowLive: 'এখনকার লাইভ তথ্য',
    eyebrowDemo: 'ডেমো খামার',
    title: 'তিনটি খামার, তিনটি আলাদা গল্প',
    intro: 'বন্যাপ্রবণ জলাভূমি, খরাপ্রবণ বরেন্দ্র অঞ্চল আর নদী-অববাহিকার আলুক্ষেত,',
    live: 'প্রতিটি আজকের উপগ্রহ তথ্য থেকে দেখা।',
    demo: 'ডেমো পরিস্থিতিতে দেখানো।',
    loading: 'খামার লোড হচ্ছে',
  },
}

function FarmCard({ farm }: { farm: MapFarm }) {
  const level = farm.overall.level
  const lang = useLang()
  const t = useText(text)
  return (
    <motion.li variants={fadeUp} className="h-full">
      <Card interactive glow={riskMeta[level].color} className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-ink">{farm.name}</h3>
            <p className="flex items-center gap-1 text-sm text-ink-muted">
              <MapPin className="size-3.5" aria-hidden="true" /> {farm.district} · {farm.crop}
            </p>
          </div>
          <RiskBadge level={level} lang={lang} />
        </div>
        <p className="text-sm text-ink">{farm.overall.summary}</p>
        <ul className="grid grid-cols-3 gap-2" aria-label={t.risks(farm.name)}>
          {(Object.keys(t.modules) as RiskModule[]).map((id) => {
            const m = farm.modules[id]
            const Icon = moduleVisuals[id].icon
            return (
              <li key={id} className="flex flex-col items-center gap-1 rounded-xl bg-surface-2 py-2 ring-1 ring-line">
                <Icon className="size-4 text-ink-muted" aria-hidden="true" />
                <span className="text-xs font-semibold text-ink">{t.modules[id]}</span>
                <span className="flex items-center gap-1 text-[11px] text-ink-muted">
                  <span className="size-2 rounded-full" style={{ backgroundColor: riskMeta[m.level].color }} aria-hidden="true" />
                  {levelLabel(m.level, lang)}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-sm font-semibold">
          <Link to={`/dashboard?farm=${encodeURIComponent(farm.id)}`} className="focus-ring inline-flex items-center gap-1 rounded-full text-leaf-300 hover:text-leaf-200">
            {t.open} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            to={`/assistant?farm=${encodeURIComponent(farm.id)}`}
            className="focus-ring inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-ink-muted ring-1 ring-line hover:text-ink"
          >
            <MessageCircle className="size-3.5" aria-hidden="true" /> {t.ask}
          </Link>
        </div>
      </Card>
    </motion.li>
  )
}

export function LiveFarms({ farms, live, failed }: { farms?: MapFarm[]; live: boolean; failed: boolean }) {
  const t = useText(text)
  if (failed) return null
  return (
    <section aria-labelledby="live-farms" className="space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-sm font-semibold tracking-widest text-leaf-300 uppercase">{live ? t.eyebrowLive : t.eyebrowDemo}</p>
        <h2 id="live-farms" className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {t.title}
        </h2>
        <p className="mx-auto max-w-xl text-ink-muted">
          {t.intro} {live ? t.live : t.demo}
        </p>
      </div>
      {farms ? (
        <motion.ul
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="grid gap-4 md:grid-cols-3"
        >
          {farms.map((farm) => (
            <FarmCard key={farm.id} farm={farm} />
          ))}
        </motion.ul>
      ) : (
        <div className="grid gap-4 md:grid-cols-3" role="status" aria-label={t.loading}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-3xl" />
          ))}
        </div>
      )}
    </section>
  )
}
