import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Clock, KeyRound, Satellite } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { timeAgo } from '@/features/dashboard/format'
import { digits, type Lang, useLang, useText } from '@/lib/i18n'
import type { MissionFreshness, SourceStatus } from '@/types/api'
import { type MissionInfo, missionState, SOURCE_NAMES } from './missions'

const stateBadge = {
  live: { tone: 'leaf', icon: <CheckCircle2 className="size-3.5" /> },
  baseline: { tone: 'sky', icon: <CheckCircle2 className="size-3.5" /> },
  'stand-in': { tone: 'harvest', icon: <KeyRound className="size-3.5" /> },
  approve: { tone: 'harvest', icon: <KeyRound className="size-3.5" /> },
  problem: { tone: 'alert', icon: <AlertTriangle className="size-3.5" /> },
  waiting: { tone: 'neutral', icon: <Clock className="size-3.5" /> },
} as const

const text = {
  en: {
    states: { live: 'Live', baseline: 'Baseline', 'stand-in': 'Using stand-in', approve: 'Approve', problem: 'Problem', waiting: 'Waiting' },
    newest: 'Newest data from space',
    unavailable: 'Unavailable',
    readings: 'Readings for your farms',
    via: (name: string) => ` via ${name}`,
    cloudy: 'Cloudy views removed',
    standIn: 'Add a free Earthdata token to use this mission’s own measurements.',
    approve: 'Your token works. Approve this archive once in Earthdata Login (see below).',
    noAnswer: 'The source did not answer.',
  },
  bn: {
    states: { live: 'লাইভ', baseline: 'স্বাভাবিক মান', 'stand-in': 'বিকল্প তথ্য', approve: 'অনুমোদন দিন', problem: 'সমস্যা', waiting: 'অপেক্ষায়' },
    newest: 'মহাকাশ থেকে সর্বশেষ তথ্য',
    unavailable: 'পাওয়া যায়নি',
    readings: 'আপনার খামারের জন্য তথ্য',
    via: (name: string) => ` (${name} থেকে)`,
    cloudy: 'মেঘলা ছবি বাদ দেওয়া হয়েছে',
    standIn: 'এই মিশনের নিজের তথ্য পেতে বিনামূল্যের Earthdata টোকেন যোগ করুন।',
    approve: 'আপনার টোকেন কাজ করছে। Earthdata Login-এ একবার এই আর্কাইভ অনুমোদন দিন (নিচে দেখুন)।',
    noAnswer: 'উৎস থেকে উত্তর আসেনি।',
  },
}

interface MissionCardProps {
  mission: MissionInfo
  sources: SourceStatus[]
  freshness: MissionFreshness | undefined
  index: number
}

// The dataset line keeps NASA's product code and translates the plain description after "·".
const PRODUCT_BN: Record<string, string> = {
  'daily 9 km soil moisture': 'দৈনিক, ৯ কিমি এলাকার মাটির আর্দ্রতা',
  'daily 0.1° rainfall (Late run)': 'দৈনিক, ০.১° এলাকার বৃষ্টি (লেট রান)',
  '250 m 16-day NDVI (Terra + Aqua)': '২৫০ মিটার, ১৬ দিনের সবুজ ভাব (Terra + Aqua)',
  '500 m 16-day NDVI, 2013–2023 seasonal normal': '৫০০ মিটার, ১৬ দিনের সবুজ ভাব, ২০১৩–২০২৩ সালের মৌসুমি স্বাভাবিক',
}

function productText(product: string, lang: Lang) {
  if (lang !== 'bn') return product
  const [code, description] = product.split(' · ')
  return description && PRODUCT_BN[description] ? `${code} · ${PRODUCT_BN[description]}` : product
}

export function MissionCard({ mission, sources, freshness, index }: MissionCardProps) {
  const state = missionState(mission, sources)
  const badge = stateBadge[state]
  const own = sources.find((s) => s.id === mission.source)
  const usesStandIn = state === 'stand-in' || state === 'approve'
  const shown = usesStandIn ? sources.find((s) => s.id === mission.standIn) : own
  const lang = useLang()
  const t = useText(text)

  return (
    <Card interactive glow="var(--color-sky-300)" className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <motion.span
            className="grid size-11 place-items-center rounded-2xl bg-sky-400/10 text-sky-300"
            animate={{ rotate: [0, 8, 0, -8, 0] }}
            transition={{ duration: 6, repeat: Infinity, delay: index * 0.7, ease: 'easeInOut' }}
          >
            <Satellite className="size-5" aria-hidden="true" />
          </motion.span>
          <div>
            <h3 className="text-lg font-extrabold text-ink">{mission.name}</h3>
            <p className="text-[11px] text-ink-subtle">{lang === 'bn' ? mission.taglineBn : mission.tagline}</p>
          </div>
        </div>
        <Badge tone={badge.tone} icon={badge.icon}>
          {t.states[state]}
        </Badge>
      </div>

      <p className="text-sm text-ink">{lang === 'bn' ? mission.measuresBn : mission.measures}</p>

      <dl className="mt-auto space-y-1.5 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-ink-subtle">{t.newest}</dt>
          <dd className="font-semibold text-ink">
            {freshness?.latest_granule ? timeAgo(freshness.latest_granule, lang) : freshness?.error ? t.unavailable : '…'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-subtle">{t.readings}</dt>
          <dd className="font-semibold text-ink tabular-nums">
            {shown ? `${digits(shown.observations, lang)}${usesStandIn ? t.via(SOURCE_NAMES[shown.id]) : ''}` : '—'}
          </dd>
        </div>
        {own && own.rejected > 0 && (
          <div className="flex justify-between gap-2">
            <dt className="text-ink-subtle">{t.cloudy}</dt>
            <dd className="font-semibold text-harvest-300 tabular-nums">{digits(own.rejected, lang)}</dd>
          </div>
        )}
      </dl>

      <p className="border-t border-line pt-2 text-[11px] text-ink-subtle">
        {state === 'stand-in' ? t.standIn : state === 'approve' ? t.approve : state === 'problem' ? (own?.message ?? t.noAnswer) : productText(own?.product ?? '', lang)}
      </p>
    </Card>
  )
}
