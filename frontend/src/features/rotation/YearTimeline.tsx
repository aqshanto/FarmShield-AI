import { motion } from 'framer-motion'
import type { Lang } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { RotationCrop } from '@/types/api'
import { cropColor, type RotationText } from './strings'

export function monthName(month: number, lang: Lang, width: 'short' | 'long' = 'short') {
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en', { month: width, timeZone: 'UTC' }).format(Date.UTC(2001, month - 1, 15))
}

/** Months 1–12 in the order this year view shows them. */
export const yearFrom = (start: number) => Array.from({ length: 12 }, (_, i) => ((start - 1 + i) % 12) + 1)

/** A crop's months as runs of columns, e.g. Nov–Feb from a November start → [[0, 4]]. */
function runs(months: number[], start: number): [number, number][] {
  const cols = months.map((m) => (m - start + 12) % 12).sort((a, b) => a - b)
  const out: [number, number][] = []
  for (const c of cols) {
    const last = out[out.length - 1]
    if (last && last[0] + last[1] === c) last[1] += 1
    else out.push([c, 1])
  }
  return out
}

interface YearTimelineProps {
  crops: RotationCrop[]
  bareMonths: number[]
  start: number
  lang: Lang
  t: RotationText
}

// Twelve months as a strip: each crop is a coloured bar that grows into its season;
// months with nothing growing are hatched, because bare soil is what washes away.
export function YearTimeline({ crops, bareMonths, start, lang, t }: YearTimelineProps) {
  const year = yearFrom(start)
  const span = (months: number[]) => `${monthName(months[0], lang)}–${monthName(months[months.length - 1], lang)}`
  return (
    <div className="space-y-1.5">
      <p className="sr-only">
        {crops.map((c) => `${c.name}: ${span(c.months)}`).join('; ')}
        {bareMonths.length > 0 && `; ${t.bare}: ${bareMonths.map((m) => monthName(m, lang)).join(', ')}`}
      </p>
      <div className="relative h-11" aria-hidden="true">
        <div className="absolute inset-0 grid grid-cols-12 gap-0.5">
          {year.map((m) => (
            <div
              key={m}
              className={
                bareMonths.includes(m)
                  ? 'rounded-md bg-[repeating-linear-gradient(135deg,var(--color-surface-3)_0_4px,transparent_4px_8px)] ring-1 ring-line'
                  : 'rounded-md bg-surface-2'
              }
            />
          ))}
        </div>
        {crops.flatMap((crop, i) =>
          runs(crop.months, start).map(([col, len], j) => (
            <motion.div
              key={`${crop.id}-${j}`}
              initial={{ scaleX: 0, opacity: 0 }}
              whileInView={{ scaleX: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ ...spring.gentle, delay: 0.15 + i * 0.12 }}
              className="absolute inset-y-0 flex origin-left items-center justify-center overflow-hidden rounded-lg px-1.5 shadow-[0_0_18px_-6px_var(--bar)]"
              style={{
                left: `calc(${(col / 12) * 100}% + 1px)`,
                width: `calc(${(len / 12) * 100}% - 2px)`,
                backgroundColor: cropColor(crop.id),
                ['--bar' as string]: cropColor(crop.id),
              }}
            >
              <span className="truncate text-xs font-bold text-night-950">{len >= 2 ? crop.name : ''}</span>
            </motion.div>
          )),
        )}
      </div>
      <div className="grid grid-cols-12 gap-0.5 text-center text-[10px] text-ink-subtle" aria-hidden="true">
        {year.map((m) => (
          <span key={m} className="truncate">
            {lang === 'bn' ? monthName(m, lang).slice(0, 3) : monthName(m, lang).slice(0, 1)}
          </span>
        ))}
      </div>
    </div>
  )
}
