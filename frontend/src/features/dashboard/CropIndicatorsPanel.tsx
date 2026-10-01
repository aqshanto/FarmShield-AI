import { motion } from 'framer-motion'
import { Bug, Cloud, Leaf, Thermometer, Waves } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { bnOf, digits, formatDate, type Lang, useLang, useText } from '@/lib/i18n'
import type { CropIndicators } from '@/types/api'

const FRESH_VIEW_DAYS = 45 // same rule as the engine: older views don't describe the field

const text = {
  en: {
    title: (crop: string) => `Crop health at a glance · ${crop}`,
    greenness: 'Greenness vs normal (MODIS, VIIRS)',
    showedWater: (date: string) => `Last clear view (${date}) showed water on the field.`,
    noView: 'No clear satellite view yet.',
    lastView: 'Last clear satellite view',
    daysAgo: 'days ago',
    cloudsSince: (date: string) => `Clouds since ${date}. Walk the field to check.`,
    on: (date: string) => `On ${date}`,
    waiting: 'Waiting for a cloud-free pass.',
    hotTitle: (limit: string) => `Hot days above ${limit}°C`,
    hotAria: (n: string, limit: string) => `${n} of 10 days above ${limit}°C`,
    hotNote: (n: string) => [`${n} of 10`, ' days (last week and next 3)'],
    diseaseTitle: (disease: string) => `Weather for ${disease}`,
    diseaseAria: (n: string, disease: string) => `${n} of 8 days suit ${disease}`,
    diseaseNote: (n: string) => [`${n} of 8`, ' days are humid and in its temperature range'],
    meter: 'Greenness compared with normal',
    meterText: (value: string, pct: string, normal: string) => `${value}, ${pct}% of the normal ${normal}`,
    ofNormal: (pct: string) => `${pct}% of normal`,
    detail: (value: string, normal: string) => ` · this season ${value}, normal ${normal}`,
  },
  bn: {
    title: (crop: string) => `এক নজরে ফসলের স্বাস্থ্য · ${crop}`,
    greenness: 'স্বাভাবিকের তুলনায় সবুজ ভাব (MODIS, VIIRS)',
    showedWater: (date: string) => `শেষ পরিষ্কার ছবিতে (${date}) জমিতে পানি দেখা গেছে।`,
    noView: 'এখনও পরিষ্কার উপগ্রহ ছবি নেই।',
    lastView: 'শেষ পরিষ্কার উপগ্রহ ছবি',
    daysAgo: 'দিন আগে',
    cloudsSince: (date: string) => `${date} থেকে মেঘ। নিজে জমি ঘুরে দেখুন।`,
    on: (date: string) => `${date} তারিখে`,
    waiting: 'মেঘমুক্ত ছবির অপেক্ষায়।',
    hotTitle: (limit: string) => `${limit}°সে-এর বেশি গরম দিন`,
    hotAria: (n: string, limit: string) => `১০ দিনের মধ্যে ${n} দিন ${limit}°সে-এর বেশি`,
    hotNote: (n: string) => [`১০ দিনের মধ্যে ${n} দিন`, ' (গত সপ্তাহ আর সামনের ৩ দিন)'],
    diseaseTitle: (disease: string) => `${bnOf(disease)} আবহাওয়া`,
    diseaseAria: (n: string, disease: string) => `৮ দিনের মধ্যে ${n} দিন ${bnOf(disease)} অনুকূল`,
    diseaseNote: (n: string) => [`৮ দিনের মধ্যে ${n} দিন`, ' আর্দ্র আর রোগের অনুকূল তাপমাত্রায়'],
    meter: 'স্বাভাবিকের তুলনায় সবুজ ভাব',
    meterText: (value: string, pct: string, normal: string) => `${value}, স্বাভাবিক ${normal}-এর ${pct}%`,
    ofNormal: (pct: string) => `স্বাভাবিকের ${pct}%`,
    detail: (value: string, normal: string) => ` · এই মৌসুমে ${value}, স্বাভাবিক ${normal}`,
  },
}

const shortDate = (iso: string, lang: Lang) => formatDate(iso, lang, { day: 'numeric', month: 'short' })

function Tile({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-1 p-3 ring-1 ring-line">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
        {icon}
        {title}
      </p>
      {children}
    </div>
  )
}

/** A row of dots, `filled` of `total` coloured: days at a glance. */
function DayDots({ filled, total, color, label }: { filled: number; total: number; color: string; label: string }) {
  return (
    <div className="flex gap-1" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <motion.span
          key={i}
          className="size-3 rounded-full ring-1 ring-line"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 20 }}
          style={{ backgroundColor: i < filled ? color : 'var(--color-surface-3)' }}
        />
      ))}
    </div>
  )
}

/** Current greenness against the seasonal normal on a 0–1 track. */
function GreennessGauge({ value, normal, stale }: { value: number; normal: number; stale: boolean }) {
  const lang = useLang()
  const t = useText(text)
  const pct = digits(Math.round((value / normal) * 100), lang)
  const v = digits(value.toFixed(2), lang)
  const nrm = digits(normal.toFixed(2), lang)
  return (
    <div className={cn('space-y-1.5', stale && 'opacity-50')}>
      <div
        className="relative h-3 rounded-full bg-surface-3"
        role="meter"
        aria-label={t.meter}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
        aria-valuetext={t.meterText(v, pct, nrm)}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: 'var(--color-chart-1)' }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        {/* Normal marker */}
        <span className="absolute -top-1 h-5 w-1 -translate-x-1/2 rounded-full" style={{ left: `${normal * 100}%`, backgroundColor: 'var(--color-chart-2)' }} />
      </div>
      <p className="text-xs text-ink-muted">
        <span className="font-bold text-ink">{t.ofNormal(pct)}</span>
        {t.detail(v, nrm)}
      </p>
    </div>
  )
}

// Visual indicators behind the crop-health score.
export function CropIndicatorsPanel({ indicators }: { indicators: CropIndicators }) {
  const lang = useLang()
  const t = useText(text)
  const { greenness, greenness_normal: normal, last_clear_view: lastView, cloud_gap_days: gap } = indicators
  const underWater = greenness !== null && greenness < 0.1
  const stale = gap !== null && gap > FRESH_VIEW_DAYS
  const limit = digits(indicators.heat_limit_c, lang)
  const [hotStrong, hotRest] = t.hotNote(digits(indicators.heat_days, lang))
  const [diseaseStrong, diseaseRest] = t.diseaseNote(digits(indicators.disease_days, lang))

  return (
    <section aria-labelledby="crop-indicators" className="space-y-3">
      <h3 id="crop-indicators" className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Leaf className="size-4 text-leaf-300" aria-hidden="true" />
        {t.title(indicators.crop)}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Tile icon={<Leaf className="size-3.5" aria-hidden="true" />} title={t.greenness}>
          {underWater && lastView ? (
            <p className="flex items-center gap-1.5 text-sm text-ink">
              <Waves className="size-4 text-sky-300" aria-hidden="true" /> {t.showedWater(shortDate(lastView, lang))}
            </p>
          ) : greenness !== null && normal ? (
            <GreennessGauge value={greenness} normal={normal} stale={stale} />
          ) : (
            <p className="text-sm text-ink-muted">{t.noView}</p>
          )}
        </Tile>

        <Tile icon={<Cloud className="size-3.5" aria-hidden="true" />} title={t.lastView}>
          {gap !== null && lastView ? (
            <>
              <p className="text-2xl font-extrabold text-ink">
                {digits(gap, lang)} <span className="text-sm font-semibold text-ink-muted">{t.daysAgo}</span>
              </p>
              <p className={cn('text-xs', stale ? 'text-harvest-300' : 'text-ink-muted')}>
                {stale ? t.cloudsSince(shortDate(lastView, lang)) : t.on(shortDate(lastView, lang))}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">{t.waiting}</p>
          )}
        </Tile>

        <Tile icon={<Thermometer className="size-3.5" aria-hidden="true" />} title={t.hotTitle(limit)}>
          <DayDots
            filled={indicators.heat_days}
            total={10}
            color="var(--color-harvest-300)"
            label={t.hotAria(digits(indicators.heat_days, lang), limit)}
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            <span className="font-bold text-ink">{hotStrong}</span>
            {hotRest}
          </p>
        </Tile>

        <Tile icon={<Bug className="size-3.5" aria-hidden="true" />} title={t.diseaseTitle(indicators.disease)}>
          <DayDots
            filled={indicators.disease_days}
            total={8}
            color="var(--color-risk-danger)"
            label={t.diseaseAria(digits(indicators.disease_days, lang), indicators.disease)}
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            <span className="font-bold text-ink">{diseaseStrong}</span>
            {diseaseRest}
          </p>
        </Tile>
      </div>
    </section>
  )
}
