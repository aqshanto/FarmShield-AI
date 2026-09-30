import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { cn } from '@/lib/cn'
import { fadeUp, stagger } from '@/lib/motion'
import { riskMeta } from '@/lib/risk'
import type { Dashboard, RiskModule } from '@/types/api'
import { moduleVisuals } from './module-visuals'

interface OverallCardProps {
  dashboard: Dashboard
  selected: RiskModule | null
  onSelect: (module: RiskModule) => void
}

// The single headline of the page: how is my farm, in one number and one sentence.
export function OverallCard({ dashboard, selected, onSelect }: OverallCardProps) {
  const { overall, farm, modules } = dashboard
  const color = riskMeta[overall.level].color

  return (
    <Card interactive glow={color} className="flex h-full flex-col gap-6 p-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <ScoreRing score={overall.score} label="Overall farm risk" caption="overall risk" size={168} className="shrink-0" />
        <div className="space-y-3 text-center sm:text-left">
          <RiskBadge level={overall.level} />
          <h2 className="text-2xl font-bold tracking-tight text-ink">{overall.summary}</h2>
          <p className="text-sm text-ink-muted">{farm.story}</p>
        </div>
      </div>

      <motion.ul variants={stagger(0.08, 0.3)} initial="hidden" animate="show" className="mt-auto grid grid-cols-3 gap-2">
        {modules.map((module) => {
          const Icon = moduleVisuals[module.id].icon
          const isSelected = selected === module.id
          return (
            <motion.li key={module.id} variants={fadeUp}>
              <button
                type="button"
                onClick={() => onSelect(module.id)}
                aria-pressed={isSelected}
                className={cn(
                  'focus-ring flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-2xl p-3 text-center ring-1 ring-line transition hover:bg-surface-2 active:scale-95',
                  isSelected && 'bg-surface-2 ring-line-strong',
                )}
              >
                <span className="relative">
                  <Icon className="size-5 text-ink-muted" aria-hidden="true" />
                  <span
                    className="absolute -top-0.5 -right-1.5 size-2.5 rounded-full ring-2 ring-night-900"
                    style={{ backgroundColor: riskMeta[module.level].color }}
                    aria-hidden="true"
                  />
                </span>
                <span className="text-xs font-semibold text-ink">{module.title}</span>
                <span className="text-[11px] text-ink-subtle">{riskMeta[module.level].label}</span>
              </button>
            </motion.li>
          )
        })}
      </motion.ul>
    </Card>
  )
}
