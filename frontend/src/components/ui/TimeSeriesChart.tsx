import { motion } from 'framer-motion'
import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

export interface ChartPoint {
  date: string // YYYY-MM-DD
  value: number
  // Drawn as an outline instead of a filled dot (e.g. lower-quality reading).
  hollow?: boolean
}

export interface ChartSeries {
  id: string
  label: string
  color: string
  // bar: daily columns · line: 2px line · points: dots joined by a faint line (sparse data)
  kind: 'bar' | 'line' | 'points'
  points: ChartPoint[]
}

interface TimeSeriesChartProps {
  series: ChartSeries[]
  start: string
  end: string
  yDomain: [number, number]
  yTicks: number[]
  formatValue: (value: number) => string
  // Accessible name, and a text description of what the chart shows.
  label: string
  summary: string
  height?: number
  emptyMessage?: string
  className?: string
}

const PAD = { top: 14, right: 44, bottom: 24, left: 34 }
const DAY_MS = 86_400_000

const toTime = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}
const shortDate = (iso: string) => new Date(toTime(iso)).toLocaleDateString('en', { month: 'short', day: 'numeric' })

function barPath(cx: number, top: number, base: number, width: number) {
  const x0 = cx - width / 2
  const x1 = cx + width / 2
  const r = Math.min(4, width / 2, base - top)
  if (r <= 0) return ''
  return `M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x1 - r} Q${x1},${top} ${x1},${top + r} V${base} Z`
}

/**
 * Daily time-series chart for observations. Legend when there are 2+ series, direct
 * end labels, crosshair tooltip on hover and arrow keys (snapping to days with data).
 */
export function TimeSeriesChart({
  series,
  start,
  end,
  yDomain,
  yTicks,
  formatValue,
  label,
  summary,
  height = 190,
  emptyMessage = 'No readings yet',
  className,
}: TimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(520)
  const [active, setActive] = useState<number | null>(null)
  const summaryId = useId()

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const t0 = toTime(start)
  const days = Math.round((toTime(end) - t0) / DAY_MS) + 1
  const dayOf = (iso: string) => Math.round((toTime(iso) - t0) / DAY_MS)
  const dateOf = (day: number) => {
    const d = new Date(t0 + day * DAY_MS)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const plotW = width - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom
  const base = PAD.top + plotH
  const x = (day: number) => PAD.left + ((day + 0.5) / days) * plotW
  const [lo, hi] = yDomain
  const y = (v: number) => PAD.top + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * plotH
  const barWidth = Math.min(24, Math.max(2, plotW / days - 2))

  // Cheap (≤ a few hundred points), so no memoisation needed.
  const visible = series.map((s) => ({ ...s, points: s.points.filter((p) => dayOf(p.date) >= 0 && dayOf(p.date) < days) }))
  // Days with at least one reading: the crosshair snaps to these.
  const dataDays = [...new Set(visible.flatMap((s) => s.points.map((p) => dayOf(p.date))))].sort((a, b) => a - b)
  const empty = dataDays.length === 0

  const nearestDataDay = (day: number) =>
    dataDays.reduce((best, d) => (Math.abs(d - day) < Math.abs(best - day) ? d : best), dataDays[0])

  const handlePointer = (event: PointerEvent<SVGRectElement>) => {
    if (empty) return
    const rect = event.currentTarget.getBoundingClientRect()
    const day = Math.floor(((event.clientX - rect.left) / rect.width) * days)
    setActive(nearestDataDay(Math.min(days - 1, Math.max(0, day))))
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (empty || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
    event.preventDefault()
    const i = active === null ? dataDays.length - 1 : dataDays.indexOf(active)
    const next = Math.min(dataDays.length - 1, Math.max(0, i + (event.key === 'ArrowRight' ? 1 : -1)))
    setActive(dataDays[next])
  }

  // Direct end labels (dropped when they would collide).
  const endLabels: { id: string; y: number; text: string }[] = []
  for (const s of visible) {
    const last = s.points[s.points.length - 1]
    if (!last) continue
    const ly = y(last.value) + 4
    if (endLabels.some((l) => Math.abs(l.y - ly) < 13)) continue
    endLabels.push({ id: s.id, y: ly, text: formatValue(last.value) })
  }

  const readings =
    active === null ? [] : visible.map((s) => ({ series: s, point: s.points.find((p) => dayOf(p.date) === active) }))
  // Tooltip sits inside the plot beside the crosshair (cards clip overflow), flipping near the right edge.
  const flip = active !== null && x(active) > width - 170
  const tooltipLeft = active === null ? 0 : x(active) + (flip ? -10 : 10)

  return (
    <div className={cn('space-y-2', className)}>
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted" aria-label="Legend">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              {s.kind === 'bar' && <span className="h-2.5 w-2 rounded-t-[2px]" style={{ backgroundColor: s.color }} />}
              {s.kind === 'line' && <span className="h-0.5 w-3.5 rounded-full" style={{ backgroundColor: s.color }} />}
              {s.kind === 'points' && <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />}
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <div
        ref={containerRef}
        role="group"
        aria-label={label}
        aria-describedby={summaryId}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => !empty && setActive((a) => a ?? dataDays[dataDays.length - 1])}
        onBlur={() => setActive(null)}
        className="focus-ring relative w-full rounded-xl"
      >
        <svg width={width} height={height} className="block" aria-hidden="true">
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(tick)} y2={y(tick)} stroke="var(--color-line)" strokeWidth="1" />
              <text x={PAD.left - 6} y={y(tick) + 3} textAnchor="end" className="fill-ink-subtle text-[10px] tabular-nums">
                {formatValue(tick)}
              </text>
            </g>
          ))}
          <line x1={PAD.left} x2={PAD.left + plotW} y1={base} y2={base} stroke="var(--color-line-strong)" strokeWidth="1" />
          {[0, Math.floor((days - 1) / 2), days - 1].map((day, i) => (
            <text
              key={day}
              x={x(day)}
              y={height - 6}
              textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
              className="fill-ink-subtle text-[10px]"
            >
              {shortDate(dateOf(day))}
            </text>
          ))}

          {visible.map((s) => {
            const sorted = [...s.points].sort((a, b) => a.date.localeCompare(b.date))
            const path = sorted.map((p, i) => `${i ? 'L' : 'M'}${x(dayOf(p.date)).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
            return (
              // Series color on a plain <g>, inherited via currentColor.
              <g key={s.id} style={{ color: s.color }}>
                {s.kind === 'bar' &&
                  sorted.map((p, i) => (
                    <motion.path
                      key={p.date}
                      d={barPath(x(dayOf(p.date)), y(p.value), base, barWidth)}
                      fill="currentColor"
                      opacity={active === null || active === dayOf(p.date) ? 1 : 0.55}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ type: 'spring', stiffness: 160, damping: 20, delay: Math.min(0.6, i * 0.012) }}
                      style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
                    />
                  ))}
                {s.kind !== 'bar' && sorted.length > 1 && (
                  <motion.path
                    key={path}
                    d={path}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeOpacity={s.kind === 'points' ? 0.45 : 1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                  />
                )}
                {s.kind === 'points' &&
                  sorted.map((p) => (
                    <circle
                      key={p.date}
                      cx={x(dayOf(p.date))}
                      cy={y(p.value)}
                      r={4.5}
                      fill={p.hollow ? 'var(--color-night-900)' : 'currentColor'}
                      stroke={p.hollow ? 'currentColor' : 'var(--color-night-900)'}
                      strokeWidth={2}
                    />
                  ))}
                {s.kind === 'line' && sorted.length > 0 && (
                  <circle
                    cx={x(dayOf(sorted[sorted.length - 1].date))}
                    cy={y(sorted[sorted.length - 1].value)}
                    r={4}
                    fill="currentColor"
                    stroke="var(--color-night-900)"
                    strokeWidth={2}
                  />
                )}
              </g>
            )
          })}

          {endLabels.map((l) => (
            <text key={l.id} x={PAD.left + plotW + 8} y={l.y} className="fill-ink text-[11px] font-bold tabular-nums">
              {l.text}
            </text>
          ))}

          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={base} stroke="var(--color-line-strong)" strokeWidth="1" />
          )}

          <rect
            x={PAD.left}
            y={0}
            width={plotW}
            height={height}
            fill="transparent"
            onPointerMove={handlePointer}
            onPointerLeave={() => setActive(null)}
          />
        </svg>

        {empty && (
          <p className="absolute inset-0 grid place-items-center text-sm text-ink-subtle" style={{ paddingBottom: PAD.bottom }}>
            {emptyMessage}
          </p>
        )}

        {active !== null && (
          <div
            className={cn(
              'pointer-events-none absolute z-10 rounded-lg bg-night-800/95 px-2.5 py-1.5 shadow-lg ring-1 ring-line-strong',
              flip && '-translate-x-full',
            )}
            style={{ left: tooltipLeft, top: PAD.top }}
          >
            <p className="mb-0.5 text-[11px] whitespace-nowrap text-ink-muted">{shortDate(dateOf(active))}</p>
            {readings.map(({ series: s, point }) => (
              <p key={s.id} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="font-bold text-ink tabular-nums">{point ? formatValue(point.value) : '—'}</span>
                <span className="text-ink-subtle">{s.label}</span>
              </p>
            ))}
          </div>
        )}

        <p id={summaryId} className="sr-only">
          {summary} Use left and right arrow keys to read each day.
        </p>
        <p className="sr-only" aria-live="polite">
          {active === null
            ? ''
            : `${shortDate(dateOf(active))}: ${readings.map(({ series: s, point }) => `${s.label} ${point ? formatValue(point.value) : 'no reading'}`).join(', ')}`}
        </p>
      </div>
    </div>
  )
}
