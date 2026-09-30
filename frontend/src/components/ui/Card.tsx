import { type HTMLMotionProps, motion } from 'framer-motion'
import { type PointerEvent, type ReactNode, useRef } from 'react'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'

interface CardProps extends HTMLMotionProps<'div'> {
  // Lifts on hover and shows a soft spotlight that follows the cursor.
  interactive?: boolean
  // Accent color for the spotlight/glow (any CSS color).
  glow?: string
}

export function Card({ interactive = false, glow = 'var(--color-leaf-400)', className, style, children, ...props }: CardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--spot-x', `${event.clientX - rect.left}px`)
    el.style.setProperty('--spot-y', `${event.clientY - rect.top}px`)
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={interactive ? handlePointerMove : undefined}
      whileHover={interactive ? { y: -4 } : undefined}
      transition={spring.gentle}
      style={{ ...style, ['--glow' as string]: glow }}
      className={cn(
        // `isolate` lets the spotlight sit at -z-10: above the card background, below the content,
        // while children stay direct descendants so layout classes (flex, grid, space-y) apply.
        'glass group/card relative isolate overflow-hidden rounded-[var(--radius-card)] p-5',
        interactive && 'transition-[border-color] duration-300 hover:border-line-strong',
        className,
      )}
      {...props}
    >
      {interactive && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
          style={{
            background:
              'radial-gradient(320px circle at var(--spot-x, 50%) var(--spot-y, 0%), color-mix(in oklab, var(--glow) 16%, transparent), transparent 70%)',
          }}
        />
      )}
      {children as ReactNode}
    </motion.div>
  )
}
