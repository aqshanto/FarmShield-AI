import { motion } from 'framer-motion'
import { Satellite } from 'lucide-react'

// Earth with a satellite in orbit: the "NASA watching over the farm" motif.
export function OrbitIllustration() {
  return (
    <div className="relative mx-auto aspect-square w-64 sm:w-80" aria-hidden="true">
      <motion.div
        className="absolute inset-0 rounded-full bg-leaf-500/20 blur-3xl"
        animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="absolute inset-[18%] overflow-hidden rounded-full bg-[radial-gradient(circle_at_35%_30%,#38bdf8_0%,#0e7490_45%,#0b1d17_100%)] shadow-[inset_-18px_-18px_40px_rgba(0,0,0,0.55)]">
        <motion.div
          className="absolute inset-y-0 -left-full flex w-[300%] items-center"
          animate={{ x: ['0%', '33.333%'] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
        >
          {[0, 1, 2].map((i) => (
            <svg key={i} viewBox="0 0 100 100" className="h-full w-1/3 opacity-90">
              <path d="M18 34c8-10 22-12 30-6 6 5 3 13 10 15 8 2 10 12 3 18-8 7-22 5-28-3-5-6-14-5-17-12-2-5-1-9 2-12Z" fill="#22c55e" />
              <path d="M62 22c6-4 16-2 19 5 2 6-4 9-9 8-6-1-13-7-10-13Z" fill="#4ade80" />
              <path d="M58 68c5-3 13-1 14 5 1 5-5 9-10 7-5-1-8-8-4-12Z" fill="#16a34a" />
            </svg>
          ))}
        </motion.div>
      </div>

      <div className="absolute inset-[6%] rounded-full border border-dashed border-sky-300/25" />

      <motion.div
        className="absolute inset-[6%]"
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
      >
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-2xl bg-night-800 p-2 shadow-lg shadow-sky-400/30 ring-1 ring-sky-300/40">
          <Satellite className="size-6 text-sky-300" strokeWidth={1.75} />
        </div>
      </motion.div>
    </div>
  )
}
