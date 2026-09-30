import { useId } from 'react'
import { cn } from '@/lib/cn'

interface SliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  // Text shown to the right of the label, e.g. "72 mm".
  valueLabel?: string
  // Fill color of the track (any CSS color).
  color?: string
  className?: string
}

// Native range input with a filled, glowing track. Fully keyboard accessible.
export function Slider({ label, value, onChange, min = 0, max = 100, step = 1, valueLabel, color = 'var(--color-leaf-400)', className }: SliderProps) {
  const id = useId()
  const percent = ((value - min) / (max - min)) * 100

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium text-ink-muted">
          {label}
        </label>
        <span className="font-semibold text-ink tabular-nums">{valueLabel ?? value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="fs-slider focus-ring w-full"
        style={{
          ['--fill' as string]: `${percent}%`,
          ['--slider-color' as string]: color,
        }}
      />
    </div>
  )
}
