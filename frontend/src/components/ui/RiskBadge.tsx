import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import { type RiskLevel, riskMeta } from '@/lib/risk'

interface RiskBadgeProps {
  level: RiskLevel
  lang?: 'en' | 'bn'
  className?: string
}

// Colored pill with a status dot; the dot pulses for warning and danger to draw attention.
export function RiskBadge({ level, lang = 'en', className }: RiskBadgeProps) {
  const meta = riskMeta[level]
  const urgent = level === 'warning' || level === 'danger'
  const label = lang === 'bn' ? meta.labelBn : meta.label

  return (
    <motion.span
      layout
      transition={spring.snappy}
      data-level={level}
      className={cn(
        'inline-flex items-center gap-2 overflow-hidden rounded-full px-3 py-1 text-xs font-bold tracking-wide ring-1',
        className,
      )}
      style={{
        // Text is lifted toward white so even danger-red clears 4.5:1 at 12px; the dot keeps the pure color.
        color: `color-mix(in oklab, ${meta.color} 70%, white)`,
        backgroundColor: `color-mix(in oklab, ${meta.color} 14%, transparent)`,
        ['--tw-ring-color' as string]: `color-mix(in oklab, ${meta.color} 40%, transparent)`,
      }}
    >
      <span className="relative flex size-2" aria-hidden="true">
        {urgent && <span className="absolute inset-0 animate-ping-soft rounded-full" style={{ backgroundColor: meta.color }} />}
        <span className="relative size-2 rounded-full" style={{ backgroundColor: meta.color }} />
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={`${level}-${lang}`}
          lang={lang}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={spring.snappy}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )
}
