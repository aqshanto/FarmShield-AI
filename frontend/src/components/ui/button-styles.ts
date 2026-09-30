import { cn } from '@/lib/cn'

export const buttonVariants = {
  primary:
    'bg-gradient-to-b from-leaf-400 to-leaf-600 text-night-950 shadow-glow-leaf hover:from-leaf-300 hover:to-leaf-500',
  secondary: 'glass text-ink hover:bg-surface-3 hover:border-line-strong',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-alert-500/15 text-alert-300 ring-1 ring-alert-400/40 hover:bg-alert-500/25',
} as const

export const buttonSizes = {
  sm: 'h-9 gap-1.5 px-3.5 text-sm',
  md: 'h-11 gap-2 px-5 text-sm',
  lg: 'h-13 gap-2.5 px-7 text-base',
} as const

export type ButtonVariant = keyof typeof buttonVariants
export type ButtonSize = keyof typeof buttonSizes

// Shared by <Button> and by links that should look like buttons.
export function buttonStyles({ variant = 'primary', size = 'md', className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    'focus-ring relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full font-semibold transition-[color,background-color,border-color,translate,scale] duration-200 select-none',
    'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0',
    buttonVariants[variant],
    buttonSizes[size],
    className,
  )
}
