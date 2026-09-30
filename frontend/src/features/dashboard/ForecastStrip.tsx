import { motion } from 'framer-motion'
import { Cloud, CloudLightning, CloudRain, CloudSun, type LucideIcon, Sun } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import type { DayForecast, WeatherCondition } from '@/types/api'
import { dayName } from './format'

const conditions: Record<WeatherCondition, { icon: LucideIcon; label: string; className: string }> = {
  sunny: { icon: Sun, label: 'Sunny', className: 'text-harvest-300 animate-spin-slow' },
  partly_cloudy: { icon: CloudSun, label: 'Partly cloudy', className: 'text-harvest-200' },
  cloudy: { icon: Cloud, label: 'Cloudy', className: 'text-ink-muted' },
  rain: { icon: CloudRain, label: 'Rain', className: 'text-sky-300 animate-float' },
  storm: { icon: CloudLightning, label: 'Storm', className: 'text-sky-200 animate-float' },
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

  return (
    <Card className="p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">Next 7 days</h2>
          <p className="text-sm text-ink-muted">
            {Math.round(totalRain)} mm of rain expected this week · weather forecast
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {heavyDays > 0 && <Badge tone="alert">{heavyDays} heavy rain {heavyDays === 1 ? 'day' : 'days'}</Badge>}
          {hotDays > 0 && <Badge tone="harvest">{hotDays} very hot {hotDays === 1 ? 'day' : 'days'}</Badge>}
          {heavyDays === 0 && hotDays === 0 && <Badge tone="leaf">Calm week</Badge>}
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
              <span className="text-xs font-bold text-ink">{dayName(day.date, i)}</span>
              <Icon className={cn('size-7', condition.className)} aria-hidden="true" />
              <span className="sr-only">{condition.label}</span>
              <span className="text-sm font-semibold text-ink">
                {Math.round(day.temp_max_c)}°<span className="font-normal text-ink-subtle"> / {Math.round(day.temp_min_c)}°</span>
              </span>

              {/* Rain column: ≤24px wide, 4px rounded top, square at the baseline. */}
              <div className="flex w-full flex-col items-center justify-end border-b border-line-strong" style={{ height: BAR_AREA_PX + 18 }}>
                <span className="mb-1 text-[11px] font-semibold text-ink-muted">{day.rain_mm > 0 ? `${Math.round(day.rain_mm)} mm` : 'Dry'}</span>
                <motion.div
                  className="w-4 origin-bottom rounded-t bg-sky-400"
                  style={{ height: barHeight }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: 'spring', stiffness: 140, damping: 18, delay: 0.2 + 0.06 * i }}
                  aria-hidden="true"
                />
              </div>

              {heavy && <span className="text-[10px] font-bold text-alert-300">Heavy rain</span>}
              {hot && <span className="text-[10px] font-bold text-harvest-300">Very hot</span>}
            </motion.li>
          )
        })}
      </ol>
    </Card>
  )
}
