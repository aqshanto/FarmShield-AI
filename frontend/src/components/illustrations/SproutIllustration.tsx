import { motion } from 'framer-motion'

interface SproutIllustrationProps {
  size?: number
  // 0–1: crop health. Healthy = upright and green; unhealthy = drooping and yellow-brown.
  health?: number
}

// A plant that visibly reacts to crop health: the core visual for crop monitoring.
export function SproutIllustration({ size = 120, health = 0.8 }: SproutIllustrationProps) {
  const h = Math.min(1, Math.max(0, health))
  const hue = 35 + h * 95 // 35 = dry yellow-brown, 130 = fresh green
  const leaf = `hsl(${hue} 70% ${45 + h * 8}%)`
  const leafDark = `hsl(${hue} 65% ${32 + h * 6}%)`
  const droop = (1 - h) * 38

  const leafTransition = { type: 'spring', stiffness: 120, damping: 12 } as const

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="100" rx="34" ry="8" fill="#5b3a1e" />
      <ellipse cx="60" cy="98" rx="28" ry="5" fill="#7a4f2a" />

      <motion.g
        style={{ transformBox: 'view-box', transformOrigin: '60px 98px' }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1, rotate: [0, 1.5, 0, -1.5, 0] }}
        transition={{
          scaleY: { type: 'spring', stiffness: 90, damping: 12 },
          rotate: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        <path d="M60 98 C60 80 59 66 60 50" stroke={leafDark} strokeWidth="4" fill="none" strokeLinecap="round" style={{ transition: 'stroke 0.5s' }} />

        {/* Fill on a plain <g> so color changes apply instantly (see ScoreRing). */}
        <g style={{ fill: leaf, transition: 'fill 0.5s' }}>
          <motion.path
            d="M60 66 C46 64 34 56 30 42 C44 40 56 48 60 66Z"
            style={{ transformBox: 'view-box', transformOrigin: '60px 66px' }}
            animate={{ rotate: -droop }}
            transition={leafTransition}
          />
          <motion.path
            d="M60 58 C74 56 86 46 90 32 C76 30 64 40 60 58Z"
            style={{ transformBox: 'view-box', transformOrigin: '60px 58px' }}
            animate={{ rotate: droop }}
            transition={leafTransition}
          />
          <motion.path
            d="M60 50 C54 40 56 28 62 20 C68 30 66 42 60 50Z"
            style={{ transformBox: 'view-box', transformOrigin: '60px 50px' }}
            animate={{ rotate: droop * 0.6 }}
            transition={leafTransition}
          />
        </g>
      </motion.g>
    </svg>
  )
}
