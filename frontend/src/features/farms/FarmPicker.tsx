import { motion } from 'framer-motion'
import { Plus, Sprout } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'

export interface FarmOption {
  id: string
  label: string
  mine: boolean // a field the farmer added
}

interface FarmPickerProps {
  farms: FarmOption[]
  value: string | null
  onChange: (id: string) => void
  ariaLabel: string
  addLabel: string
  lang?: string
}

// The farmer's own fields first, then the demo farms, then "Add farm". Scrolls sideways
// on small screens instead of wrapping into a wall of chips.
export function FarmPicker({ farms, value, onChange, ariaLabel, addLabel, lang }: FarmPickerProps) {
  return (
    <div className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 py-1" role="group" aria-label={ariaLabel} lang={lang}>
      {farms.map((farm) => {
        const selected = farm.id === value
        return (
          <button
            key={farm.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(farm.id)}
            className={cn(
              'focus-ring relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap ring-1 transition-colors',
              selected ? 'text-night-950 ring-transparent' : 'bg-surface-2 text-ink-muted ring-line hover:text-ink',
            )}
          >
            {selected && (
              <motion.span layoutId={`farm-picker-${ariaLabel}`} transition={spring.snappy} className="absolute inset-0 rounded-full bg-gradient-to-b from-leaf-300 to-leaf-500 shadow-glow-leaf" />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {farm.mine && <Sprout className="size-3.5" aria-hidden="true" />}
              {farm.label}
            </span>
          </button>
        )
      })}
      <Link
        to="/farms/new"
        className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-leaf-300 border border-dashed border-leaf-400/60 transition hover:bg-leaf-500/10"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        {addLabel}
      </Link>
    </div>
  )
}
