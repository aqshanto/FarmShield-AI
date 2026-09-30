import { motion } from 'framer-motion'
import { type KeyboardEvent, type ReactNode, useId, useRef } from 'react'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  lang?: string
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  size?: 'sm' | 'md'
  className?: string
}

// Pill switcher with a sliding highlight. Keyboard: arrow keys move the selection.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const indicatorId = useId()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options[next].value)
    buttons.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('glass inline-flex rounded-full p-1', className)}>
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            lang={option.lang}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'focus-ring relative inline-flex cursor-pointer items-center gap-1.5 rounded-full font-semibold transition-colors duration-200',
              size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
              selected ? 'text-night-950' : 'text-ink-muted hover:text-ink',
            )}
          >
            {selected && (
              <motion.span
                layoutId={indicatorId}
                transition={spring.snappy}
                className="absolute inset-0 rounded-full bg-gradient-to-b from-leaf-300 to-leaf-500 shadow-glow-leaf"
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
