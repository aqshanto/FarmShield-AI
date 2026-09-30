import { motion } from 'framer-motion'

interface RainCloudIllustrationProps {
  size?: number
  // 0–1: rainfall intensity. Drives drop count, speed and cloud darkness.
  intensity?: number
}

// Rain cloud whose storm grows with rainfall intensity (used for flood risk).
export function RainCloudIllustration({ size = 120, intensity = 0.5 }: RainCloudIllustrationProps) {
  const level = Math.min(1, Math.max(0, intensity))
  const drops = Math.round(2 + level * 10)
  const cloud = `color-mix(in oklab, #e2f3ff, #475569 ${Math.round(level * 70)}%)`
  const fallDuration = 1.1 - level * 0.5

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" className="overflow-visible">
      <g>
        {Array.from({ length: drops }, (_, i) => {
          const x = 30 + ((i * 53) % 60)
          return (
            <motion.line
              key={i}
              x1={x}
              x2={x - 3}
              y1={70}
              y2={80}
              stroke="var(--color-sky-300)"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: [0, 36], opacity: [0, 1, 0] }}
              transition={{ duration: fallDuration, repeat: Infinity, delay: (i * 0.37) % 1, ease: 'easeIn' }}
            />
          )
        })}
      </g>
      {/* Fill on a plain <g> so color changes apply instantly (see ScoreRing). */}
      <g style={{ fill: cloud, transition: 'fill 0.6s ease' }}>
        <motion.g animate={{ x: [0, 3, 0, -3, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
          <circle cx="45" cy="52" r="18" />
          <circle cx="66" cy="44" r="22" />
          <circle cx="84" cy="56" r="15" />
          <rect x="30" y="52" width="68" height="20" rx="10" />
        </motion.g>
      </g>
    </svg>
  )
}
