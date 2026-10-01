import { motion, useReducedMotion } from 'framer-motion'
import { Database, Filter, type LucideIcon, Satellite, Sprout, Download } from 'lucide-react'
import { Fragment } from 'react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { digits, numberLocale, useLang } from '@/lib/i18n'
import type { DataStatus } from '@/types/api'

interface Stage {
  icon: LucideIcon
  title: string
  value: number
  caption: string
  color: string
}

// Satellites → fetch → quality check → store → your farm, with data "flowing" between steps.
export function PipelineFlow({ status, farms }: { status: DataStatus; farms: number }) {
  const reduceMotion = useReducedMotion()
  const live = status.sources.filter((s) => s.state === 'ok').length
  const rejected = status.sources.reduce((n, s) => n + s.rejected, 0)
  const stored = status.sources.reduce((n, s) => n + s.observations, 0)

  const lang = useLang()
  const bn = lang === 'bn'
  const total = digits(status.sources.length, lang)
  const stages: Stage[] = [
    { icon: Satellite, title: bn ? 'উপগ্রহ' : 'Satellites', value: status.missions.length, caption: bn ? 'নাসার মিশনে নজর' : 'NASA missions watched', color: 'var(--color-sky-300)' },
    { icon: Download, title: bn ? 'সংগ্রহ' : 'Fetch', value: live, caption: bn ? `${total}টি উৎসের মধ্যে উত্তর দিচ্ছে` : `of ${total} sources answering`, color: 'var(--color-sky-400)' },
    { icon: Filter, title: bn ? 'মান যাচাই' : 'Quality check', value: rejected, caption: bn ? 'মেঘলা ছবি বাদ' : 'cloudy views removed', color: 'var(--color-harvest-300)' },
    { icon: Database, title: bn ? 'সংরক্ষণ' : 'Store', value: stored, caption: bn ? 'পরিষ্কার তথ্য সংরক্ষিত' : 'clean readings saved', color: 'var(--color-leaf-300)' },
    { icon: Sprout, title: bn ? 'আপনার খামার' : 'Your farms', value: farms, caption: bn ? 'খামার হালনাগাদ রাখা হচ্ছে' : 'farms kept up to date', color: 'var(--color-leaf-400)' },
  ]

  return (
    <ol className="flex flex-col gap-2 md:flex-row md:items-stretch" aria-label={bn ? 'নাসার তথ্য যেভাবে আপনার খামারে পৌঁছায়' : 'How NASA data reaches your farm'}>
      {stages.map((stage, i) => (
        <Fragment key={stage.title}>
          <motion.li
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, type: 'spring', stiffness: 220, damping: 24 }}
            className="glass flex flex-1 items-center gap-3 rounded-2xl p-3 md:flex-col md:items-start"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ color: stage.color, background: `color-mix(in oklab, ${stage.color} 14%, transparent)` }}>
              <stage.icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">{stage.title}</p>
              <p className="text-2xl font-extrabold text-ink">
                <AnimatedNumber value={stage.value} locale={numberLocale[lang]} />
              </p>
              <p className="text-xs text-ink-subtle">{stage.caption}</p>
            </div>
          </motion.li>
          {i < stages.length - 1 && (
            // Connector with a data "packet" travelling along it.
            <li aria-hidden="true" className="relative mx-auto h-5 w-0.5 bg-line md:mx-0 md:my-auto md:h-0.5 md:w-6">
              {!reduceMotion && (
                <>
                  <motion.span
                    className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-sky-300 md:hidden"
                    animate={{ top: ['-10%', '100%'] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
                  />
                  <motion.span
                    className="absolute top-1/2 hidden size-1.5 -translate-y-1/2 rounded-full bg-sky-300 md:block"
                    animate={{ left: ['-10%', '100%'] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
                  />
                </>
              )}
            </li>
          )}
        </Fragment>
      ))}
    </ol>
  )
}
