// Turns observation series into farmer-friendly sentences and stat values.
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

export function prettyDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric' })
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

export function wetnessWord(value: number) {
  if (value >= 0.8) return 'very wet'
  if (value >= 0.6) return 'moist'
  if (value >= 0.4) return 'drying'
  return 'dry'
}

// NDVI in plain words. Below ~0.1 the pixel is mostly water or bare ground, not plants.
export function greennessWord(ndvi: number) {
  if (ndvi < 0.1) return 'Water or flooded'
  if (ndvi < 0.2) return 'Bare soil'
  if (ndvi < 0.4) return 'Sparse plants'
  if (ndvi < 0.6) return 'Green'
  return 'Lush and green'
}

/** Latest clear-sky greenness, how it compares with the VIIRS normal, and the cloud gap since. */
export function greennessSummary(ndvi: ObservationPoint[], normal: ObservationPoint[], today: string) {
  const last = ndvi[ndvi.length - 1]
  if (!last) return null
  const nearest = normal.reduce<ObservationPoint | null>(
    (best, p) => (!best || Math.abs(daysBetween(p.date, last.date)) < Math.abs(daysBetween(best.date, last.date)) ? p : best),
    null,
  )
  const diff = nearest ? last.value - nearest.value : null
  const comparison =
    last.value < 0.1
      ? 'the field was under water'
      : diff === null
        ? null
        : diff > 0.08
          ? 'greener than normal'
          : diff < -0.08
            ? 'less green than normal'
            : 'about normal'
  return { last, normal: nearest, comparison, cloudGapDays: daysBetween(last.date, today) }
}
