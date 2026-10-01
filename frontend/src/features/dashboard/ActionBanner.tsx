import { motion } from 'framer-motion'
import { CheckCircle2, CloudRain, Droplets, Hand, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useLang } from '@/lib/i18n'
import type { RiskAction } from '@/types/api'

// One visual per decision. "Hold" is good news (saves water), so it uses the calm leaf tone.
const kinds: Record<RiskAction['kind'], { icon: LucideIcon; tone: string; ring: string }> = {
  irrigate: { icon: Droplets, tone: 'text-sky-300 bg-sky-400/15', ring: 'ring-sky-300/40' },
  hold: { icon: CloudRain, tone: 'text-leaf-300 bg-leaf-500/15', ring: 'ring-leaf-400/40' },
  check: { icon: Hand, tone: 'text-harvest-300 bg-harvest-400/15', ring: 'ring-harvest-300/40' },
  none: { icon: CheckCircle2, tone: 'text-leaf-300 bg-leaf-500/15', ring: 'ring-leaf-400/30' },
}

/** Compact pill for the risk card. */
export function ActionPill({ action }: { action: RiskAction }) {
  const { icon: Icon, tone, ring } = kinds[action.kind]
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1', tone, ring)}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{action.title}</span>
    </span>
  )
}

/** Full decision with its reasoning, for the detail panel. */
const NOW: Record<'en' | 'bn', string> = { en: 'What to do now', bn: 'এখন কী করবেন' }

export function ActionBanner({ action }: { action: RiskAction }) {
  const { icon: Icon, tone, ring } = kinds[action.kind]
  const now = NOW[useLang()]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex items-start gap-3 rounded-2xl p-4 ring-1', ring, 'bg-surface-1')}
      role="note"
      aria-label={now}
    >
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tone)}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs font-bold tracking-[0.15em] text-ink-subtle uppercase">{now}</p>
        <p className="text-lg font-bold text-ink">{action.title}</p>
        <p className="text-sm text-ink-muted">{action.detail}</p>
      </div>
    </motion.div>
  )
}
