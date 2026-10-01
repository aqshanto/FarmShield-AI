import { cn } from '@/lib/cn'
import { useLang } from '@/lib/i18n'

interface SpinnerProps {
  className?: string
  label?: string
}

// Small inline spinner for buttons and rows.
export function Spinner({ className, label }: SpinnerProps) {
  const lang = useLang()
  return (
    <svg
      viewBox="0 0 24 24"
      role="status"
      aria-label={label ?? (lang === 'bn' ? 'লোড হচ্ছে' : 'Loading')}
      className={cn('size-5 animate-spin text-current', className)}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
