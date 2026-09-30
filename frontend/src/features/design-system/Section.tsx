import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { fadeUp } from '@/lib/motion'

interface SectionProps {
  id: string
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}

// Showcase section that rises into view as you scroll.
export function Section({ id, eyebrow, title, description, children }: SectionProps) {
  return (
    <motion.section
      id={id}
      aria-labelledby={`${id}-title`}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="scroll-mt-24 space-y-5"
    >
      <header className="space-y-1">
        <p className="text-xs font-bold tracking-[0.2em] text-leaf-300 uppercase">{eyebrow}</p>
        <h2 id={`${id}-title`} className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {title}
        </h2>
        {description && <p className="max-w-2xl text-ink-muted">{description}</p>}
      </header>
      {children}
    </motion.section>
  )
}
