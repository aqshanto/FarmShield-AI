import { motion, useReducedMotion } from 'framer-motion'
import { BellOff, BellRing, Languages, MessageSquareText, Signal, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/lib/cn'
import { digits, useLang, useText } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import type { SmsPreview } from '@/types/api'

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

export function SmsPreviewCard({ sms }: { sms: SmsPreview[] }) {
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
    <Card className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
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
    </Card>
  )
}
