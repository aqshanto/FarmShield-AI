import { useInView, useMotionValueEvent, useReducedMotion, useSpring } from 'framer-motion'
import { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/cn'
import { numberLocale, useLang } from '@/lib/i18n'

interface AnimatedNumberProps {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  // 'bn-BD' renders Bengali numerals (০১২৩…).
  locale?: string
  // Show a + sign on positive values (for changes like "+4").
  signed?: boolean
  className?: string
}

// Counts up to `value` when scrolled into view, and springs smoothly to any new value.
export function AnimatedNumber({ value, decimals = 0, prefix = '', suffix = '', locale: localeProp, signed = false, className }: AnimatedNumberProps) {
  const lang = useLang()
  const locale = localeProp ?? numberLocale[lang]
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduceMotion = useReducedMotion()
  const motionValue = useSpring(0, { stiffness: 80, damping: 20 })

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        signDisplay: signed ? 'exceptZero' : 'auto',
      }),
    [locale, decimals, signed],
  )
  const format = (n: number) => `${prefix}${formatter.format(n)}${suffix}`

  useEffect(() => {
    if (!inView) return
    if (reduceMotion) motionValue.jump(value)
    else motionValue.set(value)
  }, [inView, value, reduceMotion, motionValue])

  useMotionValueEvent(motionValue, 'change', (latest) => {
    if (ref.current) ref.current.textContent = format(latest)
  })

  return (
    <span className={cn('tabular-nums', className)}>
      <span ref={ref} aria-hidden="true">
        {format(0)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}
