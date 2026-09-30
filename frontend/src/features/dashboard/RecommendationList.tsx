import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { SproutIllustration } from '@/components/illustrations/SproutIllustration'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/toast/useToast'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import type { Priority, Recommendation } from '@/types/api'
import { moduleVisuals } from './module-visuals'
import { useCompleted } from './useCompleted'

const priorityStyles: Record<Priority, { label: string; className: string }> = {
  high: { label: 'Do first', className: 'bg-alert-400/15 text-alert-300 ring-alert-400/30' },
  medium: { label: 'Soon', className: 'bg-harvest-400/15 text-harvest-300 ring-harvest-300/30' },
  low: { label: 'When you can', className: 'bg-sky-400/15 text-sky-300 ring-sky-300/30' },
}

const cheers = ['Nice work!', 'Great job!', 'Well done!', 'Your field thanks you!']

interface RecommendationListProps {
  farmId: string
  recommendations: Recommendation[]
}

// "What to do this week": a checklist that celebrates every finished task.
export function RecommendationList({ farmId, recommendations }: RecommendationListProps) {
  const { done, toggle } = useCompleted(farmId)
  const { toast } = useToast()
  // Only the task just ticked plays the burst (not ones restored as done on page load).
  const [justCompleted, setJustCompleted] = useState<string | null>(null)

  const total = recommendations.length
  const doneCount = recommendations.filter((r) => done.has(r.id)).length
  const allDone = total > 0 && doneCount === total
  // Open tasks first (already sorted by priority from the API), finished ones sink.
  const ordered = [...recommendations].sort((a, b) => Number(done.has(a.id)) - Number(done.has(b.id)))

  const handleToggle = (rec: Recommendation) => {
    const completing = !done.has(rec.id)
    toggle(rec.id)
    setJustCompleted(completing ? rec.id : null)
    if (completing) {
      toast({ tone: 'success', title: cheers[doneCount % cheers.length], description: `“${rec.title}” is done.` })
    }
  }

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">What to do this week</h2>
          <p className="text-sm text-ink-muted">Most important first. Tick them off as you go.</p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-ink" aria-live="polite">
          {doneCount} of {total} done
        </p>
      </div>

      <div
        className="mb-5 h-2 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-label="Tasks done"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={doneCount}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-leaf-500 to-leaf-300"
          initial={false}
          animate={{ width: total ? `${(doneCount / total) * 100}%` : '0%' }}
          transition={spring.gentle}
        />
      </div>

      <AnimatePresence initial={false}>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-leaf-500/10 p-3 ring-1 ring-leaf-400/30">
              <SproutIllustration health={1} size={56} />
              <div>
                <p className="font-bold text-leaf-200">All done for this week!</p>
                <p className="text-sm text-ink-muted">Your farm is better prepared. We’ll let you know if anything changes.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ul className="space-y-2">
        {ordered.map((rec) => {
          const isDone = done.has(rec.id)
          const priority = priorityStyles[rec.priority]
          const Icon = moduleVisuals[rec.module].icon
          return (
            <motion.li
              key={rec.id}
              layout
              transition={spring.gentle}
              className={cn('flex gap-3 rounded-2xl bg-surface-1 p-3 ring-1 ring-line transition-opacity', isDone && 'opacity-60')}
            >
              <motion.button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                aria-label={`Mark “${rec.title}” as ${isDone ? 'not done' : 'done'}`}
                onClick={() => handleToggle(rec)}
                whileTap={{ scale: 0.85 }}
                className={cn(
                  'focus-ring relative mt-0.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full ring-2 transition-colors',
                  isDone ? 'bg-leaf-400 ring-leaf-400' : 'ring-line-strong hover:ring-leaf-300',
                )}
              >
                <AnimatePresence>
                  {isDone && (
                    <motion.span
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={spring.bouncy}
                      className="text-night-950"
                    >
                      <Check className="size-4" strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
                {isDone && justCompleted === rec.id && (
                  // One-shot ring burst when a task is completed.
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full ring-2 ring-leaf-300"
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                )}
              </motion.button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn('font-semibold text-ink', isDone && 'line-through decoration-2')}>{rec.title}</p>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold ring-1', priority.className)}>{priority.label}</span>
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{rec.reason}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-ink-subtle">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {rec.due}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Icon className="size-3.5" aria-hidden="true" />
                    {rec.module === 'flood_risk' ? 'Flood' : rec.module === 'water_stress' ? 'Water' : 'Crop'}
                  </span>
                </div>
              </div>
            </motion.li>
          )
        })}
      </ul>
    </Card>
  )
}
