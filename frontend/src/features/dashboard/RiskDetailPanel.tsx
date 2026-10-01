import { Satellite, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { TrendChart } from '@/components/ui/TrendChart'
import { riskMeta } from '@/lib/risk'
import type { RiskModuleSummary } from '@/types/api'
import { ActionBanner } from './ActionBanner'
import { CropIndicatorsPanel } from './CropIndicatorsPanel'
import { FactorBreakdown } from './FactorBreakdown'
import { sourceDescriptions } from './module-visuals'

interface RiskDetailPanelProps {
  module: RiskModuleSummary
  onClose: () => void
}

// "Why is it like this?" The explanation, two-week trend and the satellites behind it.
export function RiskDetailPanel({ module, onClose }: RiskDetailPanelProps) {
  const meta = riskMeta[module.level]

  return (
    <Card glow={meta.color} className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-ink">{module.title}: why?</h2>
            <RiskBadge level={module.level} />
          </div>
          <p className="max-w-2xl text-ink-muted">{module.explanation}</p>
          {module.status && <p className="text-sm font-semibold text-ink">Status: {module.status}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="focus-ring shrink-0 cursor-pointer rounded-full p-2 text-ink-subtle transition hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-5" />
        </button>
      </div>

      {module.action && (
        <div className="mt-5">
          <ActionBanner action={module.action} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Risk over the last 2 weeks</h3>
            <TrendChart values={module.trend} color={meta.color} label={`${module.title} risk, last 14 days`} />
          </div>
          {module.indicators && <CropIndicatorsPanel indicators={module.indicators} />}
          <FactorBreakdown module={module} />
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Satellite className="size-4 text-sky-300" aria-hidden="true" />
            What the satellites looked at
          </h3>
          <ul className="space-y-2">
            {module.sources.map((source) => (
              <li key={source} className="flex items-center gap-3 rounded-xl bg-surface-1 p-3 ring-1 ring-line">
                <Badge tone="sky" className="w-16 justify-center">
                  {source}
                </Badge>
                <span className="text-sm text-ink-muted">{sourceDescriptions[source] ?? 'NASA Earth observation'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}
