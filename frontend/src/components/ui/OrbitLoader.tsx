import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface OrbitLoaderProps {
  label?: string
  className?: string
}

// Branded loader: a tiny satellite circling the Earth while data loads.
export function OrbitLoader({ label = 'Reading satellite data…', className }: OrbitLoaderProps) {
  return (
    <div role="status" className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative size-16" aria-hidden="true">
        <div className="absolute inset-[22%] rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--color-sky-400),#0e7490_55%,var(--color-night-900))]" />
        <div className="absolute inset-0 rounded-full border border-dashed border-sky-300/30" />
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
        >
          <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-harvest-300 shadow-[0_0_12px_var(--color-harvest-300)]" />
        </motion.div>
      </div>
      <p className="text-sm text-ink-muted">{label}</p>
    </div>
  )
}
