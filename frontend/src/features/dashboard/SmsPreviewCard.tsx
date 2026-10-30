import { motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, BellOff, BellRing, History, Languages, MessageSquareText, Send, Signal, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useToast } from '@/components/ui/toast/useToast'
import { ApiError, api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { digits, formatDate, useLang, useText } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import { useAsync } from '@/lib/useAsync'
import type { SmsLogEntry, SmsPreview } from '@/types/api'

type SmsLang = 'bn' | 'en'

const text = {
  en: {
    title: 'Today’s SMS alert',
    intro: 'What a farmer with a basic phone gets from FarmShield today, built from this field’s NASA risks.',
    language: 'SMS language',
    sender: 'FarmShield',
    now: 'now',
    newMessage: 'New message',
    noMessages: 'No new messages',
    quiet: 'No SMS today. Nothing on this field needs action, so FarmShield stays quiet: a text from us always means “act now”.',
    fits: (length: string, limit: string) => `${length} of ${limit} characters · 1 SMS`,
    parts: (length: string, n: string) => `${length} characters · ${n} SMS`,
    anyPhone: 'Works on any phone, with no internet',
    onlyWhenNeeded: 'Sent only on a warning or danger, so farmers keep reading them',
    bengaliLimit: 'A Bengali SMS holds 70 characters, so the advice is kept short',
    logTitle: 'Automatic SMS log',
    logNote: 'The server writes each field’s SMS by itself after the morning NASA update, once a day.',
    logEmpty: 'The first entry appears after the next NASA update.',
    statuses: { alert: 'SMS due', quiet: 'No SMS needed', sent: 'Sent to phones', failed: 'Not delivered' } as Record<SmsLogEntry['status'], string>,
    quietRow: 'Nothing needed action that day.',
    send: (n: string, one: boolean) => `Send to our ${n} team ${one ? 'phone' : 'phones'}`,
    sentTitle: 'SMS sent',
    sentTo: (n: string, one: boolean) => `It went to ${n} team ${one ? 'phone' : 'phones'}.`,
    notSent: 'SMS not sent',
    tryLater: 'Please try again in a minute.',
    used: (sent: string, limit: string) => `${sent} of ${limit} real SMS used today`,
    notSetUp: 'Real sending turns on when Twilio is set up on the server.',
  },
  bn: {
    title: 'আজকের SMS সতর্কবার্তা',
    intro: 'সাধারণ ফোনে কৃষক আজ ফার্মশিল্ড থেকে যে বার্তা পাবেন, এই জমির নাসার ঝুঁকি থেকে তৈরি।',
    language: 'SMS-এর ভাষা',
    sender: 'FarmShield',
    now: 'এখন',
    newMessage: 'নতুন বার্তা',
    noMessages: 'কোনো নতুন বার্তা নেই',
    quiet: 'আজ কোনো SMS যাবে না। এই জমিতে এখন কিছু করার দরকার নেই, তাই ফার্মশিল্ড চুপ থাকে: আমাদের বার্তা মানেই “এখনই কাজ”।',
    fits: (length: string, limit: string) => `${limit}টির মধ্যে ${length}টি অক্ষর · ১টি SMS`,
    parts: (length: string, n: string) => `${length}টি অক্ষর · ${n}টি SMS`,
    anyPhone: 'যেকোনো ফোনে চলে, ইন্টারনেট লাগে না',
    onlyWhenNeeded: 'শুধু সতর্কতা বা বিপদে পাঠানো হয়, তাই কৃষক বার্তা পড়তে অভ্যস্ত থাকেন',
    bengaliLimit: 'বাংলা SMS-এ ৭০টি অক্ষর ধরে, তাই পরামর্শ ছোট রাখা হয়',
    logTitle: 'স্বয়ংক্রিয় SMS লগ',
    logNote: 'প্রতিদিন সকালের NASA হালনাগাদের পর সার্ভার নিজেই প্রতিটি জমির বার্তা লিখে রাখে, দিনে একবার।',
    logEmpty: 'পরের NASA হালনাগাদের পর প্রথম লেখা দেখা যাবে।',
    statuses: { alert: 'SMS যাবে', quiet: 'SMS দরকার হয়নি', sent: 'ফোনে পাঠানো হয়েছে', failed: 'পাঠানো যায়নি' } as Record<SmsLogEntry['status'], string>,
    quietRow: 'সেদিন কিছু করার দরকার ছিল না।',
    send: (n: string) => `টিমের ${n}টি ফোনে পাঠান`,
    sentTitle: 'SMS পাঠানো হয়েছে',
    sentTo: (n: string) => `টিমের ${n}টি ফোনে গেছে।`,
    notSent: 'SMS পাঠানো যায়নি',
    tryLater: 'এক মিনিট পর আবার চেষ্টা করুন।',
    used: (sent: string, limit: string) => `আজ ${limit}টির মধ্যে ${sent}টি আসল SMS পাঠানো হয়েছে`,
    notSetUp: 'সার্ভারে Twilio সেট আপ করলে আসল SMS পাঠানো চালু হবে।',
  },
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']
const TYPE_MS = 28 // per character: a short SMS types in about two seconds

/** Reveals the message a few letters at a time, like it is arriving. */
function useTyped(message: string, animate: boolean) {
  const [shown, setShown] = useState(animate ? 0 : message.length)
  useEffect(() => {
    if (!animate) {
      setShown(message.length)
      return
    }
    setShown(0)
    const timer = setInterval(() => setShown((n) => (n >= message.length ? n : n + 1)), TYPE_MS)
    return () => clearInterval(timer)
  }, [message, animate])
  // Graphemes would be ideal, but slicing by code unit only ever shows a sign a moment early.
  return message.slice(0, shown)
}

function Phone({ sms, lang, t }: { sms: SmsPreview; lang: SmsLang; t: (typeof text)['en'] }) {
  const reduceMotion = useReducedMotion()
  const typed = useTyped(sms.text, !reduceMotion && sms.send)

  return (
    <motion.div
      key={`${sms.lang}-${sms.send}`}
      // A short buzz when a message arrives.
      animate={sms.send && !reduceMotion ? { rotate: [0, -4, 4, -3, 3, 0] } : { rotate: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="relative mx-auto w-56 shrink-0 rounded-[2.25rem] bg-gradient-to-b from-night-700 to-night-950 p-3 shadow-2xl ring-1 ring-line-strong"
      aria-hidden="true"
    >
      {sms.send && (
        <span className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-alert-400 text-xs font-bold text-night-950">
          <span className="absolute inset-0 animate-ping rounded-full bg-alert-400/60 motion-reduce:animate-none" />
          <span className="relative">{digits(1, lang)}</span>
        </span>
      )}
      <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-night-950/80" />

      {/* A basic phone's backlit screen. */}
      <div
        className="flex h-52 flex-col overflow-hidden rounded-xl p-3 text-[#13301b] shadow-inner"
        style={{ background: 'linear-gradient(160deg, #e3f5da, #bfe3b4)' }}
      >
        <div className="flex items-center justify-between text-[10px] font-semibold opacity-70">
          <Signal className="size-3" />
          <span>{sms.send ? t.now : ''}</span>
        </div>
        {sms.send ? (
          <>
            <div className="mt-1.5 flex items-center gap-1.5 border-b border-[#13301b]/20 pb-1.5">
              <MessageSquareText className="size-3.5" />
              <span className="text-xs font-bold">{t.sender}</span>
            </div>
            <p lang={sms.lang} className="mt-2 text-[13px] leading-snug font-medium whitespace-pre-line">
              {typed}
              {typed.length < sms.text.length && <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-[#13301b]" />}
            </p>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <BellOff className="size-7 opacity-60" />
            <span className="text-xs font-semibold opacity-80">{t.noMessages}</span>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5 px-2">
        {KEYS.map((key) => (
          <span key={key} className="rounded-full bg-night-800 py-0.5 text-center text-[10px] font-semibold text-ink-subtle ring-1 ring-line">
            {key}
          </span>
        ))}
      </div>
    </motion.div>
  )
}

const STATUS_ICONS = {
  alert: { icon: MessageSquareText, className: 'text-harvest-300' },
  quiet: { icon: BellOff, className: 'text-ink-subtle' },
  sent: { icon: Send, className: 'text-leaf-300' },
  failed: { icon: AlertTriangle, className: 'text-alert-300' },
} as const

/** The automatic daily log, and the button that texts today's SMS to the team's own phones. */
function SmsDelivery({ farmId, message, smsLang, t }: { farmId: string; message: SmsPreview; smsLang: SmsLang; t: (typeof text)['en'] }) {
  const lang = useLang()
  const { toast } = useToast()
  const [version, setVersion] = useState(0) // bumped after a send, to reload the log and the count
  const [sending, setSending] = useState(false)
  const status = useAsync(`sms-status|${version}`, (signal) => api.smsStatus({ signal }))
  const log = useAsync(`sms-log|${farmId}|${smsLang}|${version}`, (signal) => api.smsHistory(farmId, smsLang, { signal }))
  const n = (v: number) => digits(v, lang)
  const real = status.data?.real_sending ? status.data : null

  const send = async () => {
    setSending(true)
    try {
      const result = await api.smsSend(farmId, smsLang)
      toast({ tone: 'success', title: t.sentTitle, description: t.sentTo(n(result.sent), result.sent === 1) })
    } catch (error) {
      toast({ tone: 'danger', title: t.notSent, description: error instanceof ApiError && error.detail ? error.detail : t.tryLater })
    } finally {
      setSending(false)
      setVersion((v) => v + 1)
    }
  }

  return (
    <section aria-labelledby={`sms-log-${farmId}`} className="space-y-3 border-t border-line pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 id={`sms-log-${farmId}`} className="flex items-center gap-2 text-sm font-bold text-ink">
            <History className="size-4 text-leaf-300" aria-hidden="true" />
            {t.logTitle}
          </h3>
          <p className="text-xs text-ink-muted">{t.logNote}</p>
        </div>
        {real ? (
          <div className="space-y-1 text-right">
            <Button size="sm" icon={<Send className="size-4" />} loading={sending} disabled={!message.send} onClick={send}>
              {t.send(n(real.phones), real.phones === 1)}
            </Button>
            <p className="text-[11px] text-ink-subtle">{t.used(n(real.sent_today), n(real.daily_limit))}</p>
          </div>
        ) : (
          status.data && <p className="max-w-56 text-xs text-ink-subtle">{t.notSetUp}</p>
        )}
      </div>

      {log.data && log.data.length === 0 && <p className="text-xs text-ink-subtle">{t.logEmpty}</p>}
      <ol className="space-y-2">
        {(log.data ?? []).map((entry, i) => {
          const { icon: Icon, className } = STATUS_ICONS[entry.status]
          const when =
            entry.channel === 'real'
              ? formatDate(entry.created_at, lang, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
              : formatDate(entry.day, lang)
          return (
            <motion.li
              key={`${entry.created_at}-${entry.channel}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring.gentle, delay: i * 0.05 }}
              className="flex items-start gap-3 rounded-xl bg-surface-2 px-3 py-2 ring-1 ring-line"
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', className)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="flex justify-between gap-2 text-xs text-ink-muted">
                  <span className="font-semibold">{t.statuses[entry.status]}</span>
                  <span>{when}</span>
                </p>
                <p className="truncate text-sm text-ink" lang={entry.text ? smsLang : undefined}>
                  {entry.text.replace(/\n/g, ' · ') || t.quietRow}
                </p>
                {entry.status === 'failed' && entry.detail && <p className="text-xs text-alert-300">{entry.detail}</p>}
              </div>
            </motion.li>
          )
        })}
      </ol>
    </section>
  )
}

export function SmsPreviewCard({ farmId, sms }: { farmId: string; sms: SmsPreview[] }) {
  const pageLang = useLang()
  const t = useText(text)
  // Farmers get Bengali: start there, whatever language the page is in.
  const [smsLang, setSmsLang] = useState<SmsLang>('bn')
  const message = sms.find((s) => s.lang === smsLang) ?? sms[0]
  if (!message) return null

  const n = (v: number) => digits(v, pageLang)
  const fill = message.send ? Math.min(1, message.length / (message.single_limit * Math.max(1, message.parts))) : 0
  const points = [
    { icon: WifiOff, text: t.anyPhone },
    { icon: BellRing, text: t.onlyWhenNeeded },
    { icon: Languages, text: t.bengaliLimit },
  ]

  return (
    <Card className="space-y-6">
      <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <MessageSquareText className="size-5 text-leaf-300" aria-hidden="true" />
              {t.title}
            </h2>
            <p className="text-sm text-ink-muted">{t.intro}</p>
          </div>

          <SegmentedControl
            ariaLabel={t.language}
            size="sm"
            options={[
              { value: 'bn', label: 'বাংলা', lang: 'bn' },
              { value: 'en', label: 'English', lang: 'en' },
            ]}
            value={smsLang}
            onChange={setSmsLang}
          />

          {message.send ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-ink-muted">
                {message.parts === 1 ? t.fits(n(message.length), n(message.single_limit)) : t.parts(n(message.length), n(message.parts))}
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <motion.div
                  key={message.lang}
                  initial={{ width: 0 }}
                  animate={{ width: `${fill * 100}%` }}
                  transition={spring.gentle}
                  className={cn('h-full rounded-full', message.parts === 1 ? 'bg-leaf-400' : 'bg-harvest-400')}
                />
              </div>
              {/* The phone is decoration; this is the message for screen readers. */}
              <p className="sr-only" lang={message.lang}>
                {t.newMessage}: {message.text}
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink">{t.quiet}</p>
          )}

          <ul className="space-y-2">
            {points.map(({ icon: Icon, text: point }, i) => (
              <motion.li key={point} variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 * i }} className="flex items-start gap-2 text-sm text-ink-muted">
                <Icon className="mt-0.5 size-4 shrink-0 text-leaf-300" aria-hidden="true" />
                {point}
              </motion.li>
            ))}
          </ul>
        </div>

        <Phone sms={message} lang={pageLang} t={t} />
      </div>

      <SmsDelivery farmId={farmId} message={message} smsLang={smsLang} t={t} />
    </Card>
  )
}
