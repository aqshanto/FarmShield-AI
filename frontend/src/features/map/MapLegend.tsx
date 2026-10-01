import { AnimatePresence, motion } from 'framer-motion'
import { Badge } from '@/components/ui/Badge'
import { useLang, useText } from '@/lib/i18n'
import { levelLabel, RISK_LEVELS, riskMeta } from '@/lib/risk'
import type { MapLayer } from '@/types/api'

// Legend for the active layer: what it shows, where it comes from, and the four levels.
const text = {
  en: { levels: 'Risk levels', live: 'Live', liveTitle: 'Computed for every cell from today’s NASA data', demo: 'Demo data', demoTitle: 'Modelled demo surface' },
  bn: { levels: 'ঝুঁকির মাত্রা', live: 'লাইভ', liveTitle: 'আজকের নাসা তথ্য থেকে প্রতিটি এলাকার হিসাব', demo: 'ডেমো তথ্য', demoTitle: 'ডেমো মডেল' },
}

export function MapLegend({ layer }: { layer: MapLayer }) {
  const lang = useLang()
  const t = useText(text)
  return (
    <div className="glass w-64 rounded-2xl bg-night-900/85 p-4">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={layer.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          <p className="font-bold text-ink">{layer.title}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{layer.description}</p>
        </motion.div>
      </AnimatePresence>

      <ul className="mt-3 grid grid-cols-4 gap-1" aria-label={t.levels}>
        {RISK_LEVELS.map((level) => (
          <li key={level} className="text-center">
            <span className="block h-2.5 rounded-sm" style={{ backgroundColor: riskMeta[level].color }} />
            <span className="mt-1 block text-[10px] font-semibold text-ink-muted">{levelLabel(level, lang)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {layer.sources.map((s) => (
          <Badge key={s} tone="sky" className="px-2 text-[10px]">
            {s}
          </Badge>
        ))}
        {layer.live ? (
          <Badge tone="leaf" className="px-2 text-[10px]" title={t.liveTitle}>
            {t.live}
          </Badge>
        ) : (
          <Badge tone="harvest" className="px-2 text-[10px]" title={t.demoTitle}>
            {t.demo}
          </Badge>
        )}
      </div>
    </div>
  )
}
