import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, Droplets, HelpCircle, Lightbulb, Satellite, Sprout, Waves } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/cn'
import { type Lang, digits, numberLocale } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import type { RotationMetric, RotationStrategy } from '@/types/api'
import { cropColor, type RotationText } from './strings'
import { monthName, YearTimeline } from './YearTimeline'

const METRICS: RotationMetric[] = ['soil', 'water', 'climate', 'pests', 'income', 'food']
const SHOWN_GAIN = 8 // smaller differences are noise, not a reason

interface StrategyCardProps {
  strategy: RotationStrategy
  current: RotationStrategy
  best: boolean
  floodMonths: number[]
  start: number
  lang: Lang
  t: RotationText
}

function List({ icon, title, items, tone }: { icon: ReactNode; title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1.5">
      <h4 className={cn('flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase', tone)}>
        {icon} {title}
      </h4>
      <ul className="space-y-1 text-sm text-ink">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className={cn('mt-2 size-1.5 shrink-0 rounded-full bg-current', tone)} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// How well a rotation matches the farmer's priorities. Unlike the risk rings, high is good,
// so it carries no risk level.
function MatchRing({ score, color, lang, t }: { score: number; color: string; lang: Lang; t: RotationText }) {
  const size = 72
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  return (
    <div
      role="meter"
      aria-label={`${t.match}, ${t.matchCaption}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-valuetext={`${digits(score, lang)} / ${digits(100, lang)}`}
      className="flex shrink-0 flex-col items-center gap-0.5"
    >
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth={8} />
          <g style={{ stroke: color, filter: `drop-shadow(0 0 6px color-mix(in oklab, ${color} 60%, transparent))` }}>
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={c}
              initial={{ strokeDashoffset: c }}
              animate={{ strokeDashoffset: c * (1 - score / 100) }}
              transition={spring.gentle}
            />
          </g>
        </svg>
        <AnimatedNumber value={score} locale={numberLocale[lang]} className="absolute text-2xl font-extrabold text-ink" />
      </div>
      <span className="text-[11px] font-semibold text-ink-subtle" aria-hidden="true">
        {t.match}
      </span>
    </div>
  )
}

export function StrategyCard({ strategy: s, current, best, floodMonths, start, lang, t }: StrategyCardProps) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const delta = s.overall - current.overall
  const tone = s.existing ? 'sky' : best || delta >= 5 ? 'leaf' : delta <= -5 ? 'harvest' : 'neutral'
  const ring = s.existing ? 'var(--color-sky-300)' : delta >= 5 ? 'var(--color-leaf-400)' : delta <= -5 ? 'var(--color-harvest-400)' : 'var(--color-leaf-300)'
  const span = (months: number[]) => `${monthName(months[0], lang)}–${monthName(months[months.length - 1], lang)}`

  return (
    <motion.article variants={fadeUp} className="h-full">
      <Card
        interactive
        glow={ring}
        className={cn('flex h-full flex-col gap-4', best && 'ring-2 ring-leaf-400/60', s.existing && 'ring-1 ring-sky-300/40')}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <Badge tone={tone} icon={best ? <Sprout className="size-3.5" /> : undefined}>
              {s.verdict}
            </Badge>
            <h3 className="text-lg leading-snug font-bold text-ink">{s.name}</h3>
          </div>
          <MatchRing score={s.overall} color={ring} lang={lang} t={t} />
        </header>

        <YearTimeline crops={s.crops} bareMonths={s.bare_months} floodMonths={floodMonths} start={start} lang={lang} t={t} />

        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
          {s.crops.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: cropColor(c.id) }} aria-hidden="true" />
              {c.name} · {span(c.months)}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Badge tone="sky" icon={<Droplets className="size-3.5" />}>
            {s.irrigation_mm >= 50 ? t.water(digits(s.irrigation_mm, lang)) : t.noWater}
          </Badge>
          {floodMonths.length > 0 && (
            <Badge tone="sky" icon={<Waves className="size-3.5" />}>
              {t.flooded} · {span(floodMonths)}
            </Badge>
          )}
          <Badge>{s.bare_months.length ? t.bareMonths(digits(s.bare_months.length, lang)) : t.noBare}</Badge>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {METRICS.map((m, i) => {
            const gain = s.existing ? 0 : s.scores[m] - current.scores[m]
            return (
              <div key={m} className="space-y-1">
                <dt className="flex items-center justify-between gap-1 text-xs text-ink-muted">
                  <span className="truncate">{t.metrics[m]}</span>
                  {Math.abs(gain) >= SHOWN_GAIN && (
                    <span className={gain > 0 ? 'text-leaf-300' : 'text-harvest-300'}>
                      {gain > 0 ? <ArrowUp className="size-3.5" aria-hidden="true" /> : <ArrowDown className="size-3.5" aria-hidden="true" />}
                      <span className="sr-only">{gain > 0 ? t.better : t.worse}</span>
                    </span>
                  )}
                </dt>
                <dd className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${s.scores[m]}%` }}
                    viewport={{ once: true }}
                    transition={{ ...spring.gentle, delay: 0.2 + i * 0.05 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: ring }}
                  />
                  <span className="sr-only">{digits(s.scores[m], lang)} / {digits(100, lang)}</span>
                </dd>
              </div>
            )
          })}
        </dl>

        <List icon={<Lightbulb className="size-3.5" aria-hidden="true" />} title={t.why} items={s.why} tone="text-harvest-300" />
        <List icon={<Satellite className="size-3.5" aria-hidden="true" />} title={t.evidence} items={s.evidence} tone="text-sky-300" />

        <div className="mt-auto space-y-3 border-t border-line pt-3">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((o) => !o)}
            className="focus-ring flex w-full cursor-pointer items-center justify-between rounded-lg text-sm font-semibold text-leaf-300 hover:text-leaf-200"
          >
            {open ? t.less : t.more}
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring.snappy}>
              <ChevronDown className="size-4" aria-hidden="true" />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                id={detailsId}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={spring.gentle}
                className="space-y-3 overflow-hidden"
              >
                <List icon={<Check className="size-3.5" aria-hidden="true" />} title={t.benefits} items={s.benefits} tone="text-leaf-300" />
                <List icon={<HelpCircle className="size-3.5" aria-hidden="true" />} title={t.gaps} items={s.gaps} tone="text-ink-muted" />
                <List icon={<AlertTriangle className="size-3.5" aria-hidden="true" />} title={t.risks} items={s.risks} tone="text-alert-300" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.article>
  )
}
