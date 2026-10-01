import { motion } from 'framer-motion'
import { Bug, Cloud, Leaf, Thermometer, Waves } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { CropIndicators } from '@/types/api'

const FRESH_VIEW_DAYS = 45 // same rule as the engine: older views don't describe the field

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short' })

function Tile({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-1 p-3 ring-1 ring-line">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
        {icon}
        {title}
      </p>
      {children}
    </div>
  )
}

/** A row of dots, `filled` of `total` coloured: days at a glance. */
function DayDots({ filled, total, color, label }: { filled: number; total: number; color: string; label: string }) {
  return (
    <div className="flex gap-1" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <motion.span
          key={i}
          className="size-3 rounded-full ring-1 ring-line"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 20 }}
          style={{ backgroundColor: i < filled ? color : 'var(--color-surface-3)' }}
        />
      ))}
    </div>
  )
}

/** Current greenness against the seasonal normal on a 0–1 track. */
function GreennessGauge({ value, normal, stale }: { value: number; normal: number; stale: boolean }) {
  const pct = Math.round((value / normal) * 100)
  return (
    <div className={cn('space-y-1.5', stale && 'opacity-50')}>
      <div
        className="relative h-3 rounded-full bg-surface-3"
        role="meter"
        aria-label="Greenness compared with normal"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
        aria-valuetext={`${value.toFixed(2)}, ${pct}% of the normal ${normal.toFixed(2)}`}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: 'var(--color-chart-1)' }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        {/* Normal marker */}
        <span className="absolute -top-1 h-5 w-1 -translate-x-1/2 rounded-full" style={{ left: `${normal * 100}%`, backgroundColor: 'var(--color-chart-2)' }} />
      </div>
      <p className="text-xs text-ink-muted">
        <span className="font-bold text-ink">{pct}% of normal</span> · this season {value.toFixed(2)}, normal {normal.toFixed(2)}
      </p>
    </div>
  )
}

// Visual indicators behind the crop-health score.
export function CropIndicatorsPanel({ indicators }: { indicators: CropIndicators }) {
  const { greenness, greenness_normal: normal, last_clear_view: lastView, cloud_gap_days: gap } = indicators
  const underWater = greenness !== null && greenness < 0.1
  const stale = gap !== null && gap > FRESH_VIEW_DAYS

  return (
    <section aria-labelledby="crop-indicators" className="space-y-3">
      <h3 id="crop-indicators" className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Leaf className="size-4 text-leaf-300" aria-hidden="true" />
        Crop health at a glance · {indicators.crop}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Tile icon={<Leaf className="size-3.5" aria-hidden="true" />} title="Greenness vs normal (MODIS, VIIRS)">
          {underWater && lastView ? (
            <p className="flex items-center gap-1.5 text-sm text-ink">
              <Waves className="size-4 text-sky-300" aria-hidden="true" /> Last clear view ({shortDate(lastView)}) showed water on the field.
            </p>
          ) : greenness !== null && normal ? (
            <GreennessGauge value={greenness} normal={normal} stale={stale} />
          ) : (
            <p className="text-sm text-ink-muted">No clear satellite view yet.</p>
          )}
        </Tile>

        <Tile icon={<Cloud className="size-3.5" aria-hidden="true" />} title="Last clear satellite view">
          {gap !== null && lastView ? (
            <>
              <p className="text-2xl font-extrabold text-ink">
                {gap} <span className="text-sm font-semibold text-ink-muted">days ago</span>
              </p>
              <p className={cn('text-xs', stale ? 'text-harvest-300' : 'text-ink-muted')}>
                {stale ? `Clouds since ${shortDate(lastView)}. Walk the field to check.` : `On ${shortDate(lastView)}`}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Waiting for a cloud-free pass.</p>
          )}
        </Tile>

        <Tile icon={<Thermometer className="size-3.5" aria-hidden="true" />} title={`Hot days above ${indicators.heat_limit_c}°C`}>
          <DayDots filled={indicators.heat_days} total={10} color="var(--color-harvest-300)" label={`${indicators.heat_days} of 10 days above ${indicators.heat_limit_c}°C`} />
          <p className="mt-1.5 text-xs text-ink-muted">
            <span className="font-bold text-ink">{indicators.heat_days} of 10</span> days (last week and next 3)
          </p>
        </Tile>

        <Tile icon={<Bug className="size-3.5" aria-hidden="true" />} title={`Weather for ${indicators.disease}`}>
          <DayDots filled={indicators.disease_days} total={8} color="var(--color-risk-danger)" label={`${indicators.disease_days} of 8 days suit ${indicators.disease}`} />
          <p className="mt-1.5 text-xs text-ink-muted">
            <span className="font-bold text-ink">{indicators.disease_days} of 8</span> days are humid and in its temperature range
          </p>
        </Tile>
      </div>
    </section>
  )
}
