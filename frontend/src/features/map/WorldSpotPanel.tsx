import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Globe2, Plus, RotateCw, Satellite, Waves, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { OrbitLoader } from '@/components/ui/OrbitLoader'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { moduleVisuals } from '@/features/dashboard/module-visuals'
import { ApiError, api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { digits, useLang, useText } from '@/lib/i18n'
import { fadeUp, stagger } from '@/lib/motion'
import { levelLabel, riskMeta } from '@/lib/risk'
import { useAsync } from '@/lib/useAsync'
import type { PointRisk } from '@/types/api'
import { formatLatLon } from './geo'

const WORLD_CROPS = ['rice', 'wheat', 'maize', 'potato', 'tomato', 'lentil', 'mustard', 'jute'] as const
export type WorldCrop = (typeof WORLD_CROPS)[number]

const text = {
  en: {
    eyebrow: 'Anywhere on Earth',
    finding: 'Finding this place…',
    unnamed: 'Selected spot',
    clear: 'Clear selected spot',
    crop: 'Your crop',
    crops: { rice: 'Rice', wheat: 'Wheat', maize: 'Maize', potato: 'Potato', tomato: 'Tomato', lentil: 'Lentil', mustard: 'Mustard', jute: 'Jute' },
    steps: ['Finding the place on the map…', 'Reading NASA POWER rain and soil…', 'Checking land height from NASA SRTM…', 'Running flood, water and crop checks…'],
    water: 'This spot is open water.',
    waterHint: 'Tap on land to check a field.',
    todo: 'What to do',
    pending: 'NASA satellite readings (SMAP, GPM, MODIS) for this spot are downloading now. Tap it again in a few minutes for a sharper check.',
    done: 'Checked live from NASA data for this spot.',
    demo: 'Checking places outside Bangladesh needs live NASA data, and this server is running the demo scenario.',
    failed: 'We couldn’t reach NASA for this spot.',
    retry: 'Try again',
    polar: 'There is no farmland this close to the poles. Tap somewhere warmer.',
    addHere: 'Add my farm here',
  },
  bn: {
    eyebrow: 'পৃথিবীর যেকোনো জায়গা',
    finding: 'জায়গাটি খুঁজছি…',
    unnamed: 'বেছে নেওয়া জায়গা',
    clear: 'বেছে নেওয়া জায়গা মুছুন',
    crop: 'আপনার ফসল',
    crops: { rice: 'ধান', wheat: 'গম', maize: 'ভুট্টা', potato: 'আলু', tomato: 'টমেটো', lentil: 'মসুর ডাল', mustard: 'সরিষা', jute: 'পাট' },
    steps: ['মানচিত্রে জায়গাটি খুঁজছি…', 'NASA POWER থেকে বৃষ্টি আর মাটির তথ্য পড়ছি…', 'NASA SRTM থেকে জমির উচ্চতা দেখছি…', 'বন্যা, পানি আর ফসলের হিসাব করছি…'],
    water: 'এই জায়গাটি খোলা পানি।',
    waterHint: 'জমি দেখতে স্থলভাগে চাপ দিন।',
    todo: 'যা করবেন',
    pending: 'এই জায়গার জন্য নাসার উপগ্রহের তথ্য (SMAP, GPM, MODIS) এখন নামানো হচ্ছে। আরও নিখুঁত হিসাবের জন্য কয়েক মিনিট পর আবার চাপ দিন।',
    done: 'এই জায়গার জন্য নাসার তথ্য থেকে এখনই হিসাব করা।',
    demo: 'বাংলাদেশের বাইরের জায়গা দেখতে নাসার লাইভ তথ্য লাগে, আর এই সার্ভার এখন ডেমো চালাচ্ছে।',
    failed: 'এই জায়গার জন্য নাসায় পৌঁছানো যায়নি।',
    retry: 'আবার চেষ্টা করুন',
    polar: 'মেরুর এত কাছে কোনো চাষের জমি নেই। একটু উষ্ণ কোনো জায়গায় চাপ দিন।',
    addHere: 'এখানে আমার জমি যোগ করুন',
  },
}

/** While the spot is being checked: a satellite at work and what it's doing, step by step. */
function Scanning({ steps }: { steps: string[] }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1100)
    return () => clearInterval(timer)
  }, [steps.length])
  return (
    <div className="space-y-4 py-4">
      <OrbitLoader label="" />
      <ol className="space-y-1.5" aria-live="polite">
        {steps.map((label, i) => (
          <motion.li
            key={label}
            initial={false}
            animate={{ opacity: i <= step ? 1 : 0.35 }}
            className="flex items-center gap-2 text-xs text-ink-muted"
          >
            {i < step ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-leaf-300" aria-hidden="true" />
            ) : (
              <Satellite className={cn('size-3.5 shrink-0', i === step ? 'animate-pulse text-sky-300' : 'text-ink-subtle')} aria-hidden="true" />
            )}
            {label}
          </motion.li>
        ))}
      </ol>
    </div>
  )
}

function Result({ data }: { data: PointRisk }) {
  const lang = useLang()
  const t = useText(text)
  if (!data.land || !data.overall) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-sky-400/10 p-3 ring-1 ring-sky-300/25">
        <Waves className="mt-0.5 size-5 shrink-0 text-sky-300" aria-hidden="true" />
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">{t.water}</span> {t.waterHint}
        </p>
      </div>
    )
  }
  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp} className="rounded-xl bg-surface-1 p-3 ring-1 ring-line">
        <RiskBadge level={data.overall.level} lang={lang} />
        <p className="mt-2 text-sm font-semibold text-ink">{data.overall.summary}</p>
      </motion.div>

      <ul className="space-y-2">
        {data.modules.map((m) => {
          const Icon = moduleVisuals[m.id].icon
          return (
            <motion.li key={m.id} variants={fadeUp} className="rounded-xl p-3 ring-1 ring-line">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <Icon className="size-4 text-ink-muted" aria-hidden="true" />
                  {m.title}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                  <span className="size-2 rounded-full" style={{ backgroundColor: riskMeta[m.level].color }} aria-hidden="true" />
                  {levelLabel(m.level, lang)} · {digits(m.score, lang)}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: riskMeta[m.level].color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${m.score}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>
              <p className="mt-2 text-xs text-ink-muted">{m.headline}</p>
            </motion.li>
          )
        })}
      </ul>

      {data.recommendations.length > 0 && (
        <motion.section variants={fadeUp} aria-labelledby="world-todo">
          <h3 id="world-todo" className="mb-1.5 text-sm font-bold text-ink">
            {t.todo}
          </h3>
          <ul className="space-y-1.5">
            {data.recommendations.map((r) => (
              <li key={r.id} className="flex gap-2 text-sm text-ink">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-leaf-300" aria-hidden="true" />
                <span>
                  <span className="font-semibold">{r.title}</span>
                  <span className="block text-xs text-ink-subtle">{r.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      <motion.p variants={fadeUp} className="flex gap-2 rounded-xl bg-sky-400/10 p-2.5 text-xs text-ink-muted ring-1 ring-sky-300/20">
        <Satellite className="mt-0.5 size-3.5 shrink-0 text-sky-300" aria-hidden="true" />
        {data.satellites_pending ? t.pending : t.done}
      </motion.p>
    </motion.div>
  )
}

interface WorldSpotPanelProps {
  point: { lng: number; lat: number }
  crop: WorldCrop
  onCropChange: (crop: WorldCrop) => void
  onClose: () => void
}

/** A spot outside Bangladesh's grid: FarmShield checks it on demand from NASA data. */
export function WorldSpotPanel({ point, crop, onCropChange, onClose }: WorldSpotPanelProps) {
  const lang = useLang()
  const t = useText(text)
  // Same limits as the server: no farmland near the poles (and GPM stops at 60°S).
  const polar = point.lat > 75 || point.lat < -60
  const risk = useAsync(
    polar ? null : `point|${point.lat.toFixed(4)}|${point.lng.toFixed(4)}|${crop}|${lang}`,
    (signal) => api.mapPoint(point.lat, point.lng, crop, { signal }, lang),
    // 503 means "still downloading": quietly try again a few times.
    { retries: 3 },
  )
  const data = risk.status === 'success' ? risk.data : undefined
  const demo = risk.error instanceof ApiError && risk.error.status === 409
  const title = !data
    ? t.finding
    : !data.land
      ? t.water
      : [data.place, data.country].filter(Boolean).join(', ') || t.unnamed

  return (
    <section aria-labelledby="world-spot-title" className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-[0.15em] text-sky-300 uppercase">
            <Globe2 className="size-3.5" aria-hidden="true" /> {t.eyebrow}
          </p>
          <h2 id="world-spot-title" className="mt-1 text-lg font-bold text-ink">
            {risk.status === 'error' || polar ? formatLatLon(point.lat, point.lng) : title}
          </h2>
          <p className="text-xs text-ink-subtle">{formatLatLon(point.lat, point.lng)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.clear}
          className="focus-ring shrink-0 cursor-pointer rounded-full p-1.5 text-ink-subtle transition hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      {(!data || data.land) && !demo && !polar && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-subtle">{t.crop}</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t.crop}>
            {WORLD_CROPS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === crop}
                onClick={() => onCropChange(c)}
                className={cn(
                  'focus-ring cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition active:scale-95',
                  c === crop ? 'bg-leaf-400 text-night-950 ring-leaf-300' : 'bg-surface-1 text-ink-muted ring-line hover:text-ink',
                )}
              >
                {t.crops[c]}
              </button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={risk.status === 'success' ? 'result' : risk.status}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {polar ? (
            <p className="rounded-xl bg-surface-1 p-3 text-sm text-ink-muted ring-1 ring-line">{t.polar}</p>
          ) : data ? (
            <Result data={data} />
          ) : risk.status === 'error' ? (
            <div className="space-y-3 rounded-xl bg-surface-1 p-3 ring-1 ring-line">
              <p className="text-sm text-ink-muted">{demo ? t.demo : t.failed}</p>
              {!demo && (
                <Button size="sm" variant="secondary" icon={<RotateCw className="size-4" />} onClick={risk.retry}>
                  {t.retry}
                </Button>
              )}
            </div>
          ) : (
            <Scanning steps={t.steps} />
          )}
        </motion.div>
      </AnimatePresence>

      {data?.land && data.overall && (
        <Link
          to={`/farms/new?lat=${point.lat.toFixed(4)}&lon=${point.lng.toFixed(4)}`}
          className="focus-ring flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-leaf-400 to-leaf-600 px-3 py-2.5 text-sm font-semibold text-night-950 shadow-glow-leaf transition hover:from-leaf-300 hover:to-leaf-500"
        >
          <Plus className="size-4" aria-hidden="true" /> {t.addHere}
        </Link>
      )}
    </section>
  )
}
