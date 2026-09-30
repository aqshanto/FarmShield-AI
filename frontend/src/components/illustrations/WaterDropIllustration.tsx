import { motion } from 'framer-motion'
import { useId } from 'react'

interface WaterDropIllustrationProps {
  size?: number
  // 0–1: how much water is available (soil moisture). The drop fills to this level.
  level?: number
}

const DROP_PATH = 'M60 12 C60 12 24 54 24 76 C24 96 40 110 60 110 C80 110 96 96 96 76 C96 54 60 12 60 12Z'

// Water drop that fills with a moving wave to show water availability.
export function WaterDropIllustration({ size = 120, level = 0.6 }: WaterDropIllustrationProps) {
  const clipId = useId()
  const l = Math.min(1, Math.max(0, level))
  // Drop spans y=12..110; water surface sits at this y.
  const surfaceY = 110 - l * 98

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={DROP_PATH} />
        </clipPath>
      </defs>

      <path d={DROP_PATH} fill="var(--color-surface-2)" stroke="var(--color-sky-300)" strokeOpacity="0.5" strokeWidth="2" />

      <g clipPath={`url(#${clipId})`}>
        <motion.g initial={{ y: 110 }} animate={{ y: surfaceY }} transition={{ type: 'spring', stiffness: 60, damping: 14 }}>
          <motion.path
            d="M-120 0 Q-105 -6 -90 0 T-60 0 T-30 0 T0 0 T30 0 T60 0 T90 0 T120 0 T150 0 T180 0 T210 0 T240 0 V120 H-120Z"
            fill="var(--color-sky-400)"
            fillOpacity="0.85"
            animate={{ x: [0, 60] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
          />
          <motion.path
            d="M-120 3 Q-105 -3 -90 3 T-60 3 T-30 3 T0 3 T30 3 T60 3 T90 3 T120 3 T150 3 T180 3 T210 3 T240 3 V120 H-120Z"
            fill="var(--color-sky-500)"
            animate={{ x: [60, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
          />
        </motion.g>
      </g>

      <path d="M44 70 C44 60 50 50 54 44" stroke="white" strokeOpacity="0.5" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  )
}
