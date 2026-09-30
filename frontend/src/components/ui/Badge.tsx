import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

const tones = {
  neutral: 'bg-surface-2 text-ink-muted ring-line',
  leaf: 'bg-leaf-500/15 text-leaf-300 ring-leaf-400/30',
  sky: 'bg-sky-400/15 text-sky-300 ring-sky-300/30',
  harvest: 'bg-harvest-400/15 text-harvest-300 ring-harvest-300/30',
  alert: 'bg-alert-400/15 text-alert-300 ring-alert-400/30',
} as const

export interface BadgeProps {
  tone?: keyof typeof tones
  icon?: ReactNode
  className?: string
  title?: string
  children: ReactNode
}

export function Badge({ tone = 'neutral', icon, className, title, children }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
