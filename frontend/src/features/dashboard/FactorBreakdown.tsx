import { motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { digits, useLang, useText } from '@/lib/i18n'
import type { RiskFactor, RiskModuleSummary } from '@/types/api'

const text = {
  en: {
    confidence: {
      high: { tone: 'leaf' as const, label: 'High confidence', hint: 'Mission data for every factor (SMAP soil moisture included).' },
      medium: { tone: 'sky' as const, label: 'Medium confidence', hint: 'Some factors use stand-in data (e.g. NASA POWER instead of SMAP).' },
      low: { tone: 'harvest' as const, label: 'Low confidence', hint: 'Some inputs are missing, so the score leans on fewer factors.' },
    },
    counts: (pct: string) => `counts ${pct}%`,
    title: 'What drives this score',
    stop: '.',
  },
  bn: {
    confidence: {
      high: { tone: 'leaf' as const, label: 'নির্ভরযোগ্যতা বেশি', hint: 'প্রতিটি কারণের জন্য মিশনের তথ্য আছে (SMAP মাটির আর্দ্রতাসহ)।' },
      medium: { tone: 'sky' as const, label: 'নির্ভরযোগ্যতা মাঝারি', hint: 'কিছু কারণে বিকল্প তথ্য ব্যবহার হয়েছে (যেমন SMAP-এর বদলে NASA POWER)।' },
      low: { tone: 'harvest' as const, label: 'নির্ভরযোগ্যতা কম', hint: 'কিছু তথ্য নেই, তাই স্কোর কম কারণের উপর নির্ভর করছে।' },
    },
    counts: (pct: string) => `গুরুত্ব ${pct}%`,
    title: 'এই স্কোরের পেছনের কারণ',
    stop: '।',
  },
}

function FactorRow({ factor, index }: { factor: RiskFactor; index: number }) {
  const lang = useLang()
  const t = useText(text)
  return (
    <li className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-ink">
          {factor.label} <span className="text-xs font-normal text-ink-subtle">· {t.counts(digits(Math.round(factor.weight * 100), lang))}</span>
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
      <p className="text-xs text-ink-muted">
        {factor.detail}
        {/[.।]$/.test(factor.detail) ? '' : t.stop}
      </p>
    </li>
  )
}

// "What drives this score": the engine's factors, so farmers and judges can see the why.
export function FactorBreakdown({ module }: { module: RiskModuleSummary }) {
  const t = useText(text)
  if (!module.factors.length) return null
  const confidence = module.confidence ? t.confidence[module.confidence] : null
  const ordered = [...module.factors].sort((a, b) => b.score * b.weight - a.score * a.weight)

  return (
    <section aria-labelledby={`${module.id}-factors`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${module.id}-factors`} className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldCheck className="size-4 text-leaf-300" aria-hidden="true" />
          {t.title}
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
