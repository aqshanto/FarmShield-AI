import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import { clampScore, type RiskLevel, riskMeta, scoreToLevel } from '@/lib/risk'
import { AnimatedNumber } from './AnimatedNumber'

interface ScoreRingProps {
  // 0–100
  score: number
  label: string
  // Defaults to the risk level derived from the score.
  level?: RiskLevel
  // Overrides the level color (e.g. for "health" scores where high is good).
  color?: string
  caption?: string
  size?: number
  strokeWidth?: number
  // Number locale, e.g. 'bn-BD' for Bengali numerals.
  locale?: string
  className?: string
}

// Circular gauge that sweeps to the score and glows in the matching risk color.
export function ScoreRing({ score, label, level, color, caption, size = 160, strokeWidth = 12, locale, className }: ScoreRingProps) {
  const value = Math.round(clampScore(score))
  const resolvedLevel = level ?? scoreToLevel(value)
  const stroke = color ?? riskMeta[resolvedLevel].color
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={`${value} out of 100, ${riskMeta[resolvedLevel].label}`}
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-surface-3)" strokeWidth={strokeWidth} />
        {/* Color lives on a plain <g>: Framer can't interpolate CSS-variable strokes on motion elements. */}
        <g
          style={{
            stroke,
            filter: `drop-shadow(0 0 8px color-mix(in oklab, ${stroke} 60%, transparent))`,
            transition: 'stroke 0.5s ease',
          }}
        >
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - value / 100) }}
            transition={spring.gentle}
          />
        </g>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center" aria-hidden="true">
        <div>
          <AnimatedNumber value={value} locale={locale} className="block text-4xl font-extrabold text-ink" />
          {caption && <span className="text-xs font-medium text-ink-subtle">{caption}</span>}
        </div>
      </div>
    </div>
  )
}
