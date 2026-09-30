import { motion } from 'framer-motion'

interface SunIllustrationProps {
  size?: number
  // 0–1: heat level. Higher = bigger, hotter-looking sun.
  heat?: number
}

// Friendly sun with slowly turning rays; heat makes it swell and redden.
export function SunIllustration({ size = 120, heat = 0.5 }: SunIllustrationProps) {
  const h = Math.min(1, Math.max(0, heat))
  const core = `color-mix(in oklab, var(--color-harvest-300), var(--color-risk-warning) ${Math.round(h * 100)}%)`

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r={36 + h * 10} fill={core} opacity="0.18" className="animate-pulse" />
      <g className="origin-center animate-spin-slow" style={{ transformBox: 'fill-box' }}>
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x="57.5" y="8" width="5" height="16" rx="2.5" fill={core} transform={`rotate(${i * 30} 60 60)`} />
        ))}
      </g>
      <motion.circle
        cx="60"
        cy="60"
        fill={core}
        initial={{ r: 0 }}
        animate={{ r: 24 + h * 6 }}
        transition={{ type: 'spring', stiffness: 160, damping: 14 }}
      />
      <circle cx="52" cy="57" r="2.5" fill="#7c2d12" />
      <circle cx="68" cy="57" r="2.5" fill="#7c2d12" />
      <path d="M52 66q8 6 16 0" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}
