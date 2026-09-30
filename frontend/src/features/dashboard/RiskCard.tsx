import { motion } from 'framer-motion'
import { ChevronDown, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Card } from '@/components/ui/Card'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import { riskMeta } from '@/lib/risk'
import type { RiskModuleSummary } from '@/types/api'
import { moduleVisuals } from './module-visuals'

export const DETAIL_PANEL_ID = 'risk-detail'

interface RiskCardProps {
  module: RiskModuleSummary
  selected: boolean
  onSelect: () => void
}

function ChangeChip({ change }: { change: number }) {
  // Rising risk is bad news, falling risk is good news.
  const [Icon, tone, text] =
    change > 2
      ? [TrendingUp, 'text-alert-300 bg-alert-400/10', `Up ${change} this week`]
      : change < -2
        ? [TrendingDown, 'text-leaf-300 bg-leaf-500/10', `Down ${Math.abs(change)} this week`]
        : [Minus, 'text-ink-muted bg-surface-2', 'Steady this week']
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', tone)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {text}
    </span>
  )
}

export function RiskCard({ module, selected, onSelect }: RiskCardProps) {
  const visual = moduleVisuals[module.id]
  const Icon = visual.icon
  const color = riskMeta[module.level].color

  return (
    <Card
      interactive
      glow={color}
      className={cn('flex h-full flex-col gap-4', selected && 'border-transparent ring-2')}
      style={selected ? { ['--tw-ring-color' as string]: color } : undefined}
    >
      {/* Stretched button: the whole card is one big, easy tap target. */}
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        aria-controls={DETAIL_PANEL_ID}
        aria-label={`${module.title}: ${riskMeta[module.level].label}. ${module.headline} ${selected ? 'Hide' : 'Show'} details`}
        className="focus-ring absolute inset-0 z-10 cursor-pointer rounded-[var(--radius-card)]"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="grid size-9 place-items-center rounded-xl"
              style={{ color: visual.accent, background: `color-mix(in oklab, ${visual.accent} 14%, transparent)` }}
            >
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="font-bold text-ink">{module.title}</h3>
          </div>
          <RiskBadge level={module.level} />
        </div>
        <div className="-my-2 -mr-2 shrink-0">{visual.illustration(module.score, 88)}</div>
      </div>

      <p className="text-lg leading-snug font-semibold text-ink">{module.headline}</p>

      <dl className="grid grid-cols-2 gap-3">
        {module.metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl bg-surface-1 p-3 ring-1 ring-line">
            <dt className="text-xs text-ink-muted">{metric.label}</dt>
            <dd className="mt-1 flex items-baseline gap-1">
              <AnimatedNumber value={metric.value} signed={metric.label.includes('change')} className="text-2xl font-extrabold text-ink" />
              <span className="text-xs text-ink-subtle">{metric.unit}</span>
            </dd>
            <dd className="mt-1 text-[10px] font-semibold tracking-wide text-ink-subtle uppercase">{metric.source}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto flex items-center justify-between">
        <ChangeChip change={module.change_7d} />
        <span className="flex items-center gap-1 text-xs font-semibold text-ink-muted">
          {selected ? 'Hide details' : 'Details'}
          <motion.span animate={{ rotate: selected ? 180 : 0 }} transition={spring.snappy} className="inline-flex">
            <ChevronDown className="size-4" aria-hidden="true" />
          </motion.span>
        </span>
      </div>
    </Card>
  )
}
