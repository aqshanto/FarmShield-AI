import { AnimatePresence, motion } from 'framer-motion'
import { Badge } from '@/components/ui/Badge'
import { RISK_LEVELS, riskMeta } from '@/lib/risk'
import type { MapLayer } from '@/types/api'

// Legend for the active layer: what it shows, where it comes from, and the four levels.
export function MapLegend({ layer, demo }: { layer: MapLayer; demo: boolean }) {
  return (
    <div className="glass w-64 rounded-2xl bg-night-900/85 p-4">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={layer.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          <p className="font-bold text-ink">{layer.title}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{layer.description}</p>
        </motion.div>
      </AnimatePresence>

      <ul className="mt-3 grid grid-cols-4 gap-1" aria-label="Risk levels">
        {RISK_LEVELS.map((level) => (
          <li key={level} className="text-center">
            <span className="block h-2.5 rounded-sm" style={{ backgroundColor: riskMeta[level].color }} />
            <span className="mt-1 block text-[10px] font-semibold text-ink-muted">{riskMeta[level].label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {layer.sources.map((s) => (
          <Badge key={s} tone="sky" className="px-2 text-[10px]">
            {s}
          </Badge>
        ))}
        {demo && (
          <Badge tone="harvest" className="px-2 text-[10px]" title="Modelled demo surface. Live NASA grids arrive in the data pipeline phase.">
            Demo data
          </Badge>
        )}
      </div>
    </div>
  )
}
