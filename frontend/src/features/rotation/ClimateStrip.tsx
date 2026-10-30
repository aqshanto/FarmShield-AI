import { motion } from 'framer-motion'
import { CloudRain } from 'lucide-react'
import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { type Lang, digits } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { RotationPlan } from '@/types/api'
import type { RotationText } from './strings'
import { monthName, yearFrom } from './YearTimeline'

interface ClimateStripProps {
  plan: RotationPlan
  start: number
  lang: Lang
  t: RotationText
}

// The field's usual year from NASA POWER normals: rain bars that rise month by month,
// monsoon months glowing, with the normal daytime high under each. Pointing at (or
// tapping) a month reads it out in full below the bars.
export function ClimateStrip({ plan, start, lang, t }: ClimateStripProps) {
  const byMonth = new Map(plan.climate.map((c) => [c.month, c]))
  const max = Math.max(1, ...plan.climate.map((c) => c.rain_mm))
  const wettest = plan.climate.reduce((a, b) => (b.rain_mm > a.rain_mm ? b : a), plan.climate[0])
  const [active, setActive] = useState<number>(wettest?.month ?? start)
  const label = (m: number) => {
    const c = byMonth.get(m)
    return c ? t.rainLabel(monthName(m, lang, 'long'), digits(Math.round(c.rain_mm), lang), digits(Math.round(c.tmax), lang)) : ''
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <CloudRain className="size-5 text-sky-300" aria-hidden="true" /> {t.climateTitle}
        </h2>
        <p className="text-xs text-ink-subtle">{t.climateNote}</p>
      </div>
      <div className="grid grid-cols-12 items-end gap-1" role="group" aria-label={t.climateTitle}>
        {yearFrom(start).map((m, i) => {
          const c = byMonth.get(m)
          if (!c) return <span key={m} />
          const wet = plan.wet_months.includes(m)
          return (
            <button
              key={m}
              type="button"
              aria-label={label(m)}
              aria-pressed={active === m}
              onPointerEnter={() => setActive(m)}
              onFocus={() => setActive(m)}
              onClick={() => setActive(m)}
              className="focus-ring flex cursor-pointer flex-col items-center gap-1 rounded-lg"
            >
              <span className="flex h-24 w-full items-end">
                <motion.span
                  initial={{ height: 0 }}
                  whileInView={{ height: `${Math.max(4, (c.rain_mm / max) * 100)}%` }}
                  viewport={{ once: true }}
                  transition={{ ...spring.gentle, delay: i * 0.04 }}
                  className={cn(
                    'block w-full rounded-t-md transition-[filter] duration-200',
                    wet ? 'bg-gradient-to-t from-sky-500 to-sky-300 shadow-[0_0_16px_-4px_var(--color-sky-400)]' : 'bg-sky-300/35',
                    active === m && 'brightness-125 ring-2 ring-sky-200',
                  )}
                />
              </span>
              <span className={cn('w-full truncate text-[10px] font-semibold', active === m ? 'text-ink' : 'text-ink-muted')}>{monthName(m, lang)}</span>
              <span className="text-[10px] text-ink-subtle">{digits(Math.round(c.tmax), lang)}°</span>
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="font-semibold text-ink" aria-live="polite">
          {label(active)}
        </p>
        <p className="flex items-center gap-2 text-ink-subtle">
          <span className="size-2.5 rounded-sm bg-sky-400" aria-hidden="true" /> {t.wet}
        </p>
      </div>
    </Card>
  )
}
