import type { Transition, Variants } from 'framer-motion'

// Shared motion vocabulary so every component moves with the same personality.
export const spring = {
  snappy: { type: 'spring', stiffness: 420, damping: 30 },
  gentle: { type: 'spring', stiffness: 220, damping: 26 },
  bouncy: { type: 'spring', stiffness: 500, damping: 16 },
} satisfies Record<string, Transition>

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: spring.gentle },
}

export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: spring.bouncy },
}

export function stagger(staggerChildren = 0.08, delayChildren = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  }
}
