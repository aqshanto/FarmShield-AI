import { motion } from 'framer-motion'
import { Home } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useLang } from '@/lib/i18n'
import { levelLabel, riskMeta } from '@/lib/risk'
import type { MapFarm, RiskModule } from '@/types/api'

interface FarmMarkerProps {
  farm: MapFarm
  layer: RiskModule
  selected: boolean
}

// A farm pin colored by its level on the active layer; urgent farms pulse.
export function FarmMarker({ farm, layer, selected }: FarmMarkerProps) {
  const lang = useLang()
  const { level } = farm.modules[layer]
  const color = riskMeta[level].color
  const urgent = level === 'warning' || level === 'danger'

  return (
    <button
      type="button"
      aria-label={`${farm.name}, ${farm.district}: ${levelLabel(level, lang)}`}
      className="group focus-ring relative flex cursor-pointer flex-col items-center rounded-full"
    >
      {/* Outer: one-time pop-in after the fly-in. Inner: selection / hover scale. */}
      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 2.2 }}>
        <motion.span
          animate={{ scale: selected ? 1.25 : 1 }}
          whileHover={{ scale: 1.2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="relative grid size-8 place-items-center rounded-full bg-night-900 shadow-lg ring-[3px]"
          style={{ ['--tw-ring-color' as string]: color }}
        >
          {urgent && <span className="absolute inset-0 animate-ping-soft rounded-full" style={{ backgroundColor: color }} />}
          <Home className="relative size-4 text-ink" aria-hidden="true" />
        </motion.span>
      </motion.span>
      <span
        className={cn(
          'mt-1 rounded-full bg-night-900/90 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-ink shadow ring-1 ring-line-strong transition-opacity',
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
        )}
      >
        {farm.name}
      </span>
    </button>
  )
}
