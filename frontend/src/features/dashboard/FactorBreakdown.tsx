import { motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { RiskFactor, RiskModuleSummary } from '@/types/api'

const confidenceCopy = {
  high: { tone: 'leaf', label: 'High confidence', hint: 'Mission data for every factor (SMAP soil moisture included).' },
  medium: { tone: 'sky', label: 'Medium confidence', hint: 'Some factors use stand-in data (e.g. NASA POWER instead of SMAP).' },
  low: { tone: 'harvest', label: 'Low confidence', hint: 'Some inputs are missing, so the score leans on fewer factors.' },
} as const

function FactorRow({ factor, index }: { factor: RiskFactor; index: number }) {
  return (
    <li className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-ink">
          {factor.label} <span className="text-xs font-normal text-ink-subtle">· counts {Math.round(factor.weight * 100)}%</span>
        </p>
        <span className="text-xs text-ink-subtle">{factor.source}</span>
      </div>
      {/* Meter: 0–100 contribution strength, single series in chart colour 1. */}
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-3"
        role="meter"
        aria-label={`${factor.label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={factor.score}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: 'var(--color-chart-1)' }}
          initial={{ width: 0 }}
          animate={{ width: `${factor.score}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 * index }}
        />
      </div>
      <p className="text-xs text-ink-muted">{factor.detail}.</p>
    </li>
  )
}

// "What drives this score": the engine's factors, so farmers and judges can see the why.
export function FactorBreakdown({ module }: { module: RiskModuleSummary }) {
  if (!module.factors.length) return null
  const confidence = module.confidence ? confidenceCopy[module.confidence] : null
  const ordered = [...module.factors].sort((a, b) => b.score * b.weight - a.score * a.weight)

  return (
    <section aria-labelledby={`${module.id}-factors`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${module.id}-factors`} className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldCheck className="size-4 text-leaf-300" aria-hidden="true" />
          What drives this score
        </h3>
        {confidence && (
          <Badge tone={confidence.tone} title={confidence.hint}>
            {confidence.label}
          </Badge>
        )}
      </div>
      <ul className="space-y-3">
        {ordered.map((factor, i) => (
          <FactorRow key={factor.id} factor={factor} index={i} />
        ))}
      </ul>
    </section>
  )
}
