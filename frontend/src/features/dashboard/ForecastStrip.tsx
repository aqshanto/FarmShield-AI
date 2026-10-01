import { motion } from 'framer-motion'
import { Cloud, CloudLightning, CloudRain, CloudSun, type LucideIcon, Sun } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { digits, useLang, useText } from '@/lib/i18n'
import type { DayForecast, WeatherCondition } from '@/types/api'
import { dayName } from './format'

const conditions: Record<WeatherCondition, { icon: LucideIcon; className: string }> = {
  sunny: { icon: Sun, className: 'text-harvest-300 animate-spin-slow' },
  partly_cloudy: { icon: CloudSun, className: 'text-harvest-200' },
  cloudy: { icon: Cloud, className: 'text-ink-muted' },
  rain: { icon: CloudRain, className: 'text-sky-300 animate-float' },
  storm: { icon: CloudLightning, className: 'text-sky-200 animate-float' },
}

const text = {
  en: {
    conditions: { sunny: 'Sunny', partly_cloudy: 'Partly cloudy', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm' } as Record<WeatherCondition, string>,
    title: 'Next 7 days',
    total: (mm: string) => `${mm} mm of rain expected this week · weather forecast`,
    heavyDays: (n: number, s: string) => `${s} heavy rain ${n === 1 ? 'day' : 'days'}`,
    hotDays: (n: number, s: string) => `${s} very hot ${n === 1 ? 'day' : 'days'}`,
    calm: 'Calm week',
    noForecast: 'The weather forecast isn’t available right now. Your risks still use NASA’s measured rain, and the forecast will be back on the next check.',
    mm: 'mm',
    dry: 'Dry',
    heavy: 'Heavy rain',
    hot: 'Very hot',
  },
  bn: {
    conditions: { sunny: 'রোদ', partly_cloudy: 'আংশিক মেঘলা', cloudy: 'মেঘলা', rain: 'বৃষ্টি', storm: 'ঝড়' } as Record<WeatherCondition, string>,
    title: 'সামনের ৭ দিন',
    total: (mm: string) => `এই সপ্তাহে ${mm} মিমি বৃষ্টি হতে পারে · আবহাওয়ার পূর্বাভাস`,
    heavyDays: (_n: number, s: string) => `${s} দিন ভারী বৃষ্টি`,
    hotDays: (_n: number, s: string) => `${s} দিন খুব গরম`,
    calm: 'শান্ত সপ্তাহ',
    noForecast: 'এই মুহূর্তে আবহাওয়ার পূর্বাভাস পাওয়া যাচ্ছে না। আপনার ঝুঁকির হিসাব নাসার মাপা বৃষ্টি দিয়েই চলছে, পরের বার পূর্বাভাস ফিরে আসবে।',
    mm: 'মিমি',
    dry: 'শুকনো',
    heavy: 'ভারী বৃষ্টি',
    hot: 'খুব গরম',
  },
}

const HEAVY_RAIN_MM = 50
const VERY_HOT_C = 38
const BAR_AREA_PX = 64

export function ForecastStrip({ forecast }: { forecast: DayForecast[] }) {
  const totalRain = forecast.reduce((sum, d) => sum + d.rain_mm, 0)
  // Scale bars against at least 60 mm so a light drizzle doesn't look like a flood.
  const scale = Math.max(60, ...forecast.map((d) => d.rain_mm))
  const heavyDays = forecast.filter((d) => d.rain_mm >= HEAVY_RAIN_MM).length
  const hotDays = forecast.filter((d) => d.temp_max_c >= VERY_HOT_C).length
  const lang = useLang()
  const t = useText(text)
  const n = (v: number) => digits(Math.round(v), lang)

  if (forecast.length === 0) {
    return (
      <Card className="flex items-start gap-4 p-6">
        <Cloud className="mt-1 size-7 shrink-0 animate-float text-ink-muted" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-bold text-ink">{t.title}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t.noForecast}</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">{t.title}</h2>
          <p className="text-sm text-ink-muted">{t.total(n(totalRain))}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {heavyDays > 0 && <Badge tone="alert">{t.heavyDays(heavyDays, n(heavyDays))}</Badge>}
          {hotDays > 0 && <Badge tone="harvest">{t.hotDays(hotDays, n(hotDays))}</Badge>}
          {heavyDays === 0 && hotDays === 0 && <Badge tone="leaf">{t.calm}</Badge>}
        </div>
      </div>

      {/* Scrolls sideways on small phones; fits in one row from tablets up. */}
      <ol className="-mx-2 flex snap-x gap-2 overflow-x-auto px-2 pb-2 sm:grid sm:grid-cols-7 sm:overflow-visible">
        {forecast.map((day, i) => {
          const condition = conditions[day.condition]
          const Icon = condition.icon
          const heavy = day.rain_mm >= HEAVY_RAIN_MM
          const hot = day.temp_max_c >= VERY_HOT_C
          const barHeight = day.rain_mm > 0 ? Math.max(4, (day.rain_mm / scale) * BAR_AREA_PX) : 0

          return (
            <motion.li
              key={day.date}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className={cn(
                'flex min-w-[4.5rem] snap-start flex-col items-center gap-2 rounded-2xl bg-surface-1 px-2 py-3 text-center ring-1 ring-line',
                i === 0 && 'bg-surface-2',
                heavy && 'ring-alert-400/50',
                hot && 'ring-harvest-400/50',
              )}
            >
              <span className="text-xs font-bold text-ink">{dayName(day.date, i, lang)}</span>
              <Icon className={cn('size-7', condition.className)} aria-hidden="true" />
              <span className="sr-only">{t.conditions[day.condition]}</span>
              <span className="text-sm font-semibold text-ink">
                {n(day.temp_max_c)}°<span className="font-normal text-ink-subtle"> / {n(day.temp_min_c)}°</span>
              </span>

              {/* Rain column: ≤24px wide, 4px rounded top, square at the baseline. */}
              <div className="flex w-full flex-col items-center justify-end border-b border-line-strong" style={{ height: BAR_AREA_PX + 18 }}>
                <span className="mb-1 text-[11px] font-semibold text-ink-muted">{day.rain_mm > 0 ? `${n(day.rain_mm)} ${t.mm}` : t.dry}</span>
                <motion.div
                  className="w-4 origin-bottom rounded-t bg-sky-400"
                  style={{ height: barHeight }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: 'spring', stiffness: 140, damping: 18, delay: 0.2 + 0.06 * i }}
                  aria-hidden="true"
                />
              </div>

              {heavy && <span className="text-[10px] font-bold text-alert-300">{t.heavy}</span>}
              {hot && <span className="text-[10px] font-bold text-harvest-300">{t.hot}</span>}
            </motion.li>
          )
        })}
      </ol>
    </Card>
  )
}
