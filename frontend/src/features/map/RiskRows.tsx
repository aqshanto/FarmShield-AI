import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { digits, useLang } from '@/lib/i18n'
import { levelLabel, riskMeta, scoreToLevel } from '@/lib/risk'
import type { MapLayer, RiskModule } from '@/types/api'
import { moduleVisuals } from '@/features/dashboard/module-visuals'

interface RiskRowsProps {
  layers: MapLayer[]
  scores: Record<RiskModule, number>
  active: RiskModule
  onSelectLayer: (layer: RiskModule) => void
}

// All three risks for one place as compact meters; tapping one switches the map layer.
export function RiskRows({ layers, scores, active, onSelectLayer }: RiskRowsProps) {
  const lang = useLang()
  return (
    <ul className="space-y-2">
      {layers.map((layer) => {
        const score = scores[layer.id]
        const level = scoreToLevel(score)
        const Icon = moduleVisuals[layer.id].icon
        const isActive = layer.id === active
        return (
          <li key={layer.id}>
            <button
              type="button"
              onClick={() => onSelectLayer(layer.id)}
              aria-pressed={isActive}
              className={cn(
                'focus-ring w-full cursor-pointer rounded-xl p-3 text-left ring-1 ring-line transition hover:bg-surface-2',
                isActive && 'bg-surface-2 ring-line-strong',
              )}
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <Icon className="size-4 text-ink-muted" aria-hidden="true" />
                  {layer.title}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                  <span className="size-2 rounded-full" style={{ backgroundColor: riskMeta[level].color }} aria-hidden="true" />
                  {levelLabel(level, lang)} · {digits(score, lang)}
                </span>
              </div>
              {/* Meter: fill carries severity, track is a lighter step. */}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: riskMeta[level].color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
