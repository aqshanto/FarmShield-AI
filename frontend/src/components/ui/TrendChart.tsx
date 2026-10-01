import { motion } from 'framer-motion'
import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { digits, type Lang, useLang } from '@/lib/i18n'

interface TrendChartProps {
  // Daily values on a 0–100 scale, oldest first; the last value is today.
  values: number[]
  // Stroke / area color (status color of the current level).
  color: string
  // Names the series, e.g. "Flood risk, last 14 days". Also the accessible name.
  label: string
  height?: number
  className?: string
}

const PAD = { top: 14, right: 40, bottom: 22, left: 8 }
const GUIDES = [25, 50, 75]

function dayLabel(index: number, count: number, lang: Lang) {
  const ago = count - 1 - index
  if (lang === 'bn') return ago === 0 ? 'আজ' : ago === 1 ? 'গতকাল' : `${digits(ago, lang)} দিন আগে`
  if (ago === 0) return 'Today'
  if (ago === 1) return 'Yesterday'
  return `${ago} days ago`
}

/**
 * Single-series risk trend. 2px line + 10% area wash, hairline threshold guides, an
 * end-dot with a surface ring and a direct end label. Hover or arrow keys show a crosshair
 * tooltip; a hidden summary plus a live readout make every value reachable by screen reader.
 */
export function TrendChart({ values, color, label, height = 140, className }: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(360)
  const [active, setActive] = useState<number | null>(null)
  const summaryId = useId()
  const n = values.length
  const lang = useLang()
  const d = (v: number) => digits(v, lang)

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const plotW = width - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (n <= 1 ? plotW : (i / (n - 1)) * plotW)
  const y = (v: number) => PAD.top + (1 - Math.min(100, Math.max(0, v)) / 100) * plotH
  const baseline = PAD.top + plotH

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`
  const last = values[n - 1]

  const indexFromPointer = (event: PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    return Math.round(Math.min(1, Math.max(0, ratio)) * (n - 1))
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    setActive((i) => Math.min(n - 1, Math.max(0, (i ?? n - 1) + step)))
  }

  const tooltipLeft = active === null ? 0 : Math.min(Math.max(x(active), 56), width - 56)

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={label}
      aria-describedby={summaryId}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => setActive((i) => i ?? n - 1)}
      onBlur={() => setActive(null)}
      className={cn('focus-ring relative w-full rounded-xl', className)}
    >
      <svg width={width} height={height} className="block" aria-hidden="true">
        {/* Recessive hairline guides at the risk thresholds. */}
        {GUIDES.map((g) => (
          <line key={g} x1={PAD.left} x2={PAD.left + plotW} y1={y(g)} y2={y(g)} stroke="var(--color-line)" strokeWidth="1" />
        ))}
        <line x1={PAD.left} x2={PAD.left + plotW} y1={baseline} y2={baseline} stroke="var(--color-line-strong)" strokeWidth="1" />

        {/* Series color on a plain <g> so it updates instantly (Framer can't tween CSS-var paints). */}
        <g style={{ color, transition: 'color 0.4s' }}>
          <motion.path
            d={area}
            fill="currentColor"
            fillOpacity={0.1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          />
          <motion.path
            key={line}
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
          <circle cx={x(n - 1)} cy={y(last)} r={4} fill="currentColor" stroke="var(--color-night-900)" strokeWidth={2} />

          {active !== null && (
            <>
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={baseline} stroke="var(--color-line-strong)" strokeWidth="1" />
              <circle cx={x(active)} cy={y(values[active])} r={5} fill="currentColor" stroke="var(--color-night-900)" strokeWidth={2} />
            </>
          )}
        </g>

        {/* Direct end label in ink, never the series color. */}
        <text x={x(n - 1) + 10} y={y(last) + 4} className="fill-ink text-xs font-bold">
          {d(last)}
        </text>
        <text x={PAD.left} y={height - 4} className="fill-ink-subtle text-[10px]">
          2 weeks ago
        </text>
        <text x={PAD.left + plotW} y={height - 4} textAnchor="end" className="fill-ink-subtle text-[10px]">
          Today
        </text>

        {/* Hit area: the whole plot, so the pointer only needs the right day, not the line. */}
        <rect
          x={PAD.left}
          y={0}
          width={plotW}
          height={height}
          fill="transparent"
          onPointerMove={(event) => setActive(indexFromPointer(event))}
          onPointerLeave={() => setActive(null)}
        />
      </svg>

      {active !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 -translate-y-full rounded-lg bg-night-800 px-2.5 py-1.5 text-center shadow-lg ring-1 ring-line-strong"
          style={{ left: tooltipLeft }}
        >
          <p className="text-sm font-bold text-ink">{d(values[active])}</p>
          <p className="text-[11px] whitespace-nowrap text-ink-muted">{dayLabel(active, n, lang)}</p>
        </div>
      )}

      <p id={summaryId} className="sr-only">
        {lang === 'bn'
          ? `${label}: দুই সপ্তাহ আগে ${d(values[0])}, এক সপ্তাহ আগে ${d(values[Math.max(0, n - 8)])}, আজ ${d(last)}। প্রতিদিনের মান শুনতে বাঁ ও ডান তীর-চাবি ব্যবহার করুন।`
          : `${label}: ${values[0]} two weeks ago, ${values[Math.max(0, n - 8)]} a week ago, ${last} today. Use left and right arrow keys to read each day.`}
      </p>
      <p className="sr-only" aria-live="polite">
        {active !== null ? `${dayLabel(active, n, lang)}: ${d(values[active])}` : ''}
      </p>
    </div>
  )
}
