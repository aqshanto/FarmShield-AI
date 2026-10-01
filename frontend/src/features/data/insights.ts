// Turns observation series into farmer-friendly sentences and stat values.
import { formatDate, type Lang } from '@/lib/i18n'
import type { ObservationPoint, VariableSeries } from '@/types/api'

const DAY_MS = 86_400_000

// Local-calendar arithmetic. (toISOString() would convert to UTC and shift the day in
// time zones ahead of UTC, like Bangladesh at UTC+6.)
export function isoDaysBefore(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / DAY_MS)
}

export function prettyDate(iso: string, lang: Lang = 'en') {
  return formatDate(iso, lang, { month: 'short', day: 'numeric' })
}

export function find(variables: VariableSeries[], id: VariableSeries['id']) {
  return variables.find((v) => v.id === id)
}

export function sumSince(points: ObservationPoint[], sinceIso: string) {
  return points.filter((p) => p.date >= sinceIso).reduce((sum, p) => sum + p.value, 0)
}

export function rainSummary(points: ObservationPoint[], today: string) {
  if (!points.length) return null
  const last30 = points.filter((p) => p.date > isoDaysBefore(today, 30))
  const wettest = last30.reduce((a, b) => (b.value > a.value ? b : a), last30[0] ?? points[0])
  return {
    week: sumSince(points, isoDaysBefore(today, 7)),
    month: sumSince(points, isoDaysBefore(today, 30)),
    wettest,
    lastDate: points[points.length - 1].date,
  }
}

const WETNESS: Record<Lang, [string, string, string, string]> = {
  en: ['very wet', 'moist', 'drying', 'dry'],
  bn: ['খুব ভেজা', 'আর্দ্র', 'শুকাচ্ছে', 'শুকনো'],
}

export function wetnessWord(value: number, lang: Lang = 'en') {
  return WETNESS[lang][value >= 0.8 ? 0 : value >= 0.6 ? 1 : value >= 0.4 ? 2 : 3]
}

// NDVI in plain words. Below ~0.1 the pixel is mostly water or bare ground, not plants.
const GREENNESS: Record<Lang, [string, string, string, string, string]> = {
  en: ['Water or flooded', 'Bare soil', 'Sparse plants', 'Green', 'Lush and green'],
  bn: ['পানি বা বন্যা', 'খালি মাটি', 'হালকা গাছপালা', 'সবুজ', 'সতেজ ও সবুজ'],
}

export function greennessWord(ndvi: number, lang: Lang = 'en') {
  return GREENNESS[lang][ndvi < 0.1 ? 0 : ndvi < 0.2 ? 1 : ndvi < 0.4 ? 2 : ndvi < 0.6 ? 3 : 4]
}

const COMPARISON: Record<Lang, Record<'water' | 'greener' | 'less' | 'normal', string>> = {
  en: { water: 'the field was under water', greener: 'greener than normal', less: 'less green than normal', normal: 'about normal' },
  bn: { water: 'জমি পানির নিচে ছিল', greener: 'স্বাভাবিকের চেয়ে বেশি সবুজ', less: 'স্বাভাবিকের চেয়ে কম সবুজ', normal: 'প্রায় স্বাভাবিক' },
}

/** Latest clear-sky greenness, how it compares with the VIIRS normal, and the cloud gap since. */
export function greennessSummary(ndvi: ObservationPoint[], normal: ObservationPoint[], today: string, lang: Lang = 'en') {
  const last = ndvi[ndvi.length - 1]
  if (!last) return null
  const nearest = normal.reduce<ObservationPoint | null>(
    (best, p) => (!best || Math.abs(daysBetween(p.date, last.date)) < Math.abs(daysBetween(best.date, last.date)) ? p : best),
    null,
  )
  const diff = nearest ? last.value - nearest.value : null
  const words = COMPARISON[lang]
  const comparison =
    last.value < 0.1 ? words.water : diff === null ? null : diff > 0.08 ? words.greener : diff < -0.08 ? words.less : words.normal
  return { last, normal: nearest, comparison, cloudGapDays: daysBetween(last.date, today) }
}
