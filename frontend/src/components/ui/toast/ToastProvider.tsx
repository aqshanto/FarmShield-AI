import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, X } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { spring } from '@/lib/motion'
import { useLang } from '@/lib/i18n'
import { type ToastApi, ToastContext, type ToastItem, type ToastTone } from './toast-context'

const toneStyles: Record<ToastTone, { icon: ReactNode; color: string }> = {
  success: { icon: <CheckCircle2 className="size-5" />, color: 'var(--color-risk-safe)' },
  info: { icon: <Info className="size-5" />, color: 'var(--color-sky-300)' },
  warning: { icon: <AlertTriangle className="size-5" />, color: 'var(--color-risk-warning)' },
  danger: { icon: <OctagonAlert className="size-5" />, color: 'var(--color-risk-danger)' },
}

const MAX_VISIBLE = 4

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback<ToastApi['toast']>(
    ({ title, description, tone = 'info', duration = 4500 }) => {
      const id = nextId.current++
      setToasts((list) => [...list, { id, title, description, tone, duration }].slice(-MAX_VISIBLE))
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      )
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss])
  const bn = useLang() === 'bn'

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ol
        aria-live="polite"
        aria-label={bn ? 'বিজ্ঞপ্তি' : 'Notifications'}
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const style = toneStyles[t.tone]
            return (
              <motion.li
                key={t.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
                transition={spring.snappy}
                role={t.tone === 'danger' ? 'alert' : undefined}
                className="glass pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl bg-night-900/90 p-4 pr-10"
              >
                <div className="flex gap-3">
                  <span style={{ color: style.color }} className="mt-0.5 shrink-0">
                    {style.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{t.title}</p>
                    {t.description && <p className="mt-0.5 text-sm text-ink-muted">{t.description}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label={bn ? 'বিজ্ঞপ্তি বন্ধ করুন' : 'Dismiss notification'}
                  className="focus-ring absolute top-3 right-3 cursor-pointer rounded-full p-1 text-ink-subtle transition hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-4" />
                </button>
                <motion.span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 h-0.5 w-full origin-left"
                  style={{ backgroundColor: style.color }}
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: t.duration / 1000, ease: 'linear' }}
                />
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ol>
    </ToastContext.Provider>
  )
}
