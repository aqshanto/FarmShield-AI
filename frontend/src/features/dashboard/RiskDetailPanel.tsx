import { Satellite, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { TrendChart } from '@/components/ui/TrendChart'
import { StageMeter } from '@/features/field/FieldView'
import { fieldCrop } from '@/features/field/fieldState'
import { useLang, useText } from '@/lib/i18n'
import { riskMeta } from '@/lib/risk'
import type { RiskModuleSummary } from '@/types/api'
import { ActionBanner } from './ActionBanner'
import { CropIndicatorsPanel } from './CropIndicatorsPanel'
import { FactorBreakdown } from './FactorBreakdown'
import { sourceDescriptions } from './module-visuals'

interface RiskDetailPanelProps {
  module: RiskModuleSummary
  // The farm's crop, so the stage reads right (e.g. paddy water is normal for rice).
  crop?: string
  onClose: () => void
}

// "Why is it like this?" The explanation, two-week trend and the satellites behind it.
const text = {
  en: {
    why: (title: string) => `${title}: why?`,
    status: 'Status',
    close: 'Close details',
    trend: 'Risk over the last 2 weeks',
    trendLabel: (title: string) => `${title} risk, last 14 days`,
    satellites: 'What the satellites looked at',
  },
  bn: {
    why: (title: string) => `${title}: কেন?`,
    status: 'অবস্থা',
    close: 'বিস্তারিত বন্ধ করুন',
    trend: 'গত ২ সপ্তাহের ঝুঁকি',
    trendLabel: (title: string) => `${title}, গত ১৪ দিন`,
    satellites: 'উপগ্রহ যা দেখেছে',
  },
}

export function RiskDetailPanel({ module, crop, onClose }: RiskDetailPanelProps) {
  const meta = riskMeta[module.level]
  const lang = useLang()
  const t = useText(text)

  return (
    <Card glow={meta.color} className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-ink">{t.why(module.title)}</h2>
            <RiskBadge level={module.level} lang={lang} />
          </div>
          <p className="max-w-2xl text-ink-muted">{module.explanation}</p>
          {module.status && <p className="text-sm font-semibold text-ink">
              {t.status}: {module.status}
            </p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="focus-ring shrink-0 cursor-pointer rounded-full p-2 text-ink-subtle transition hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-5" />
        </button>
      </div>

      {crop && (
        <div className="mt-5 max-w-sm">
          <StageMeter module={module.id} level={module.level} crop={fieldCrop(crop)} lang={lang} />
        </div>
      )}

      {module.action && (
        <div className="mt-5">
          <ActionBanner action={module.action} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">{t.trend}</h3>
            <TrendChart values={module.trend} color={meta.color} label={t.trendLabel(module.title)} />
          </div>
          {module.indicators && <CropIndicatorsPanel indicators={module.indicators} />}
          <FactorBreakdown module={module} />
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Satellite className="size-4 text-sky-300" aria-hidden="true" />
            {t.satellites}
          </h3>
          <ul className="space-y-2">
            {module.sources.map((source) => (
              <li key={source} className="flex items-center gap-3 rounded-xl bg-surface-1 p-3 ring-1 ring-line">
                <Badge tone="sky" className="w-16 justify-center">
                  {source}
                </Badge>
                <span className="text-sm text-ink-muted">{sourceDescriptions[lang][source] ?? sourceDescriptions[lang].fallback}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}
