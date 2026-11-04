import { motion } from 'framer-motion'
import { Droplet } from 'lucide-react'
import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { type Lang, digits } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { GroundwaterYear } from '@/types/api'
import type { RotationText } from './strings'

export type GroundwaterLevel = 'veryLow' | 'low' | 'normal' | 'high'

// Percentile against 1948–2012: below 25 is the driest quarter of years on record.
export function groundwaterLevel(percentile: number): GroundwaterLevel {
  return percentile < 10 ? 'veryLow' : percentile < 25 ? 'low' : percentile <= 75 ? 'normal' : 'high'
}

const LEVEL_COLORS: Record<GroundwaterLevel, string> = {
  veryLow: 'bg-alert-400',
  low: 'bg-harvest-400',
  normal: 'bg-sky-400',
  high: 'bg-leaf-400',
}

interface GroundwaterStripProps {
  years: GroundwaterYear[]
  lang: Lang
  t: RotationText
}

// Groundwater at the end of each dry season since 2003 (NASA GRACE), one bar per year,
// coloured by level. Pointing at (or tapping) a year reads it out below the bars.
export function GroundwaterStrip({ years, lang, t }: GroundwaterStripProps) {
  const [active, setActive] = useState(years.length - 1)
  const label = (i: number) => t.groundwaterReading(digits(years[i].year, lang), t.groundwaterLevels[groundwaterLevel(years[i].percentile)])

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <Droplet className="size-5 text-sky-300" aria-hidden="true" /> {t.groundwaterTitle}
        </h2>
        <p className="text-xs text-ink-subtle">{t.groundwaterNote}</p>
      </div>
      <div className="flex h-28 items-end gap-0.5 sm:gap-1" role="group" aria-label={t.groundwaterTitle}>
        {years.map((y, i) => (
          <button
            key={y.year}
            type="button"
            aria-label={label(i)}
            aria-pressed={active === i}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            className="focus-ring flex h-full min-w-0 flex-1 cursor-pointer items-end rounded-sm"
          >
            <motion.span
              initial={{ height: 0 }}
              whileInView={{ height: `${Math.max(4, y.percentile)}%` }}
              viewport={{ once: true }}
              transition={{ ...spring.gentle, delay: i * 0.03 }}
              className={cn(
                'block w-full rounded-t-sm transition-[filter] duration-200',
                LEVEL_COLORS[groundwaterLevel(y.percentile)],
                active === i ? 'brightness-125 ring-2 ring-ink/60' : 'opacity-85',
              )}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-ink-subtle" aria-hidden="true">
        <span>{digits(years[0].year, lang)}</span>
        <span>{digits(years[years.length - 1].year, lang)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="font-semibold text-ink" aria-live="polite">
          {label(active)}
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-ink-subtle">
          {(['veryLow', 'low', 'normal', 'high'] as const).map((level) => (
            <li key={level} className="flex items-center gap-1.5">
              <span className={cn('size-2.5 rounded-sm', LEVEL_COLORS[level])} aria-hidden="true" />
              {t.groundwaterLevels[level]}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
