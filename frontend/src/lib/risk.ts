// Farmer-facing risk scale. Every module (flood, water, crop) reports a 0–100 risk score
// that maps onto these four levels, so colors and wording stay consistent everywhere.

export type RiskLevel = 'safe' | 'watch' | 'warning' | 'danger'

export const RISK_LEVELS: readonly RiskLevel[] = ['safe', 'watch', 'warning', 'danger']

interface RiskMeta {
  label: string
  labelBn: string
  message: string
  messageBn: string
  // CSS color token, usable in inline styles and SVG strokes.
  color: string
}

export const riskMeta: Record<RiskLevel, RiskMeta> = {
  safe: {
    label: 'Safe',
    labelBn: 'নিরাপদ',
    message: 'All good. No action needed.',
    messageBn: 'সব ঠিক আছে। কিছু করার দরকার নেই।',
    color: 'var(--color-risk-safe)',
  },
  watch: {
    label: 'Watch',
    labelBn: 'নজরে রাখুন',
    message: 'Keep an eye on your field.',
    messageBn: 'আপনার জমির দিকে নজর রাখুন।',
    color: 'var(--color-risk-watch)',
  },
  warning: {
    label: 'Warning',
    labelBn: 'সতর্কতা',
    message: 'Prepare now to protect your crop.',
    messageBn: 'ফসল রক্ষায় এখনই প্রস্তুতি নিন।',
    color: 'var(--color-risk-warning)',
  },
  danger: {
    label: 'Danger',
    labelBn: 'বিপদ',
    message: 'Act today. Your crop is at risk.',
    messageBn: 'আজই ব্যবস্থা নিন। আপনার ফসল ঝুঁকিতে।',
    color: 'var(--color-risk-danger)',
  },
}

// Literal hex values of the --color-risk-* tokens, for places that can't read CSS
// variables (WebGL map paint). A test keeps these in sync with styles/index.css.
export const RISK_HEX: Record<RiskLevel, string> = {
  safe: '#4ade80',
  watch: '#fde047',
  warning: '#fb923c',
  danger: '#f43f5e',
}

export function scoreToLevel(score: number): RiskLevel {
  const s = clampScore(score)
  if (s < 25) return 'safe'
  if (s < 50) return 'watch'
  if (s < 75) return 'warning'
  return 'danger'
}

export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0
  return Math.min(100, Math.max(0, score))
}
