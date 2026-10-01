// NASA's own global pictures (GIBS), drawn under FarmShield's Bangladesh risk grid.
// Colors are the official GIBS color maps, so the legends match what's on the map.
// https://nasa-gibs.github.io/gibs-api-docs/
import type { Lang } from '@/lib/i18n'
import { GIBS } from './basemaps'

export type NasaLayerId = 'soil' | 'rain' | 'green'

export interface NasaLayer {
  id: NasaLayerId
  gibs: string
  matrix: string
  maxzoom: number
  mission: string
  opacity: number
  // Legend gradient, low → high (sampled from the GIBS color map).
  stops: string[]
  text: Record<Lang, { name: string; low: string; high: string; about: string }>
}

export const NASA_LAYERS: NasaLayer[] = [
  {
    id: 'soil',
    gibs: 'SMAP_L4_Analyzed_Surface_Soil_Moisture',
    matrix: 'GoogleMapsCompatible_Level6',
    maxzoom: 6,
    mission: 'SMAP',
    opacity: 0.8,
    stops: ['#ffa200', '#ffec00', '#88c300', '#009832', '#00f9f3', '#005fff', '#0000c9'],
    text: {
      en: { name: 'Soil moisture', low: 'Dry', high: 'Wet', about: 'How wet the topsoil is, from the SMAP satellite.' },
      bn: { name: 'মাটির আর্দ্রতা', low: 'শুকনো', high: 'ভেজা', about: 'SMAP উপগ্রহ থেকে, উপরের মাটি কতটা ভেজা।' },
    },
  },
  {
    id: 'rain',
    gibs: 'IMERG_Precipitation_Rate',
    matrix: 'GoogleMapsCompatible_Level6',
    maxzoom: 6,
    mission: 'GPM',
    opacity: 0.85,
    stops: ['#00764e', '#1eb200', '#efed00', '#ff4d2d', '#b50000'],
    text: {
      en: { name: 'Rainfall', low: 'Light', high: 'Heavy', about: 'Where it rained, from the GPM satellites (IMERG).' },
      bn: { name: 'বৃষ্টি', low: 'হালকা', high: 'ভারী', about: 'GPM উপগ্রহ (IMERG) থেকে, কোথায় বৃষ্টি হয়েছে।' },
    },
  },
  {
    id: 'green',
    gibs: 'MODIS_Terra_NDVI_8Day',
    matrix: 'GoogleMapsCompatible_Level9',
    maxzoom: 9,
    mission: 'MODIS',
    opacity: 0.8,
    stops: ['#e5dbcd', '#c8b5a5', '#9a6e59', '#96ba20', '#5da300', '#197300', '#005a00'],
    text: {
      en: { name: 'Greenness', low: 'Bare', high: 'Very green', about: 'How green the plants are, from MODIS on the Terra satellite (last 8 days).' },
      bn: { name: 'সবুজ ভাব', low: 'খালি মাটি', high: 'খুব সবুজ', about: 'Terra উপগ্রহের MODIS থেকে, গাছপালা কতটা সবুজ (গত ৮ দিন)।' },
    },
  },
]

export const nasaLayer = (id: NasaLayerId) => NASA_LAYERS.find((l) => l.id === id)!
export const isNasaLayerId = (value: string | null): value is NasaLayerId => NASA_LAYERS.some((l) => l.id === value)
export const nasaLayerId = (id: NasaLayerId) => `nasa-${id}`

// "default" asks GIBS for the newest day it has, so the map never shows an empty date.
export const nasaTileUrl = (layer: NasaLayer) => `${GIBS}/${layer.gibs}/default/default/${layer.matrix}/{z}/{y}/{x}.png`

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/** The newest day GIBS has for this layer (its DescribeDomains document), or null. */
export async function latestDate(layer: NasaLayer, signal?: AbortSignal, now = new Date()): Promise<string | null> {
  const from = new Date(now.getTime() - 40 * 86_400_000)
  const to = new Date(now.getTime() + 86_400_000)
  const url = `${GIBS}/1.0.0/${layer.gibs}/default/${layer.matrix}/all/${isoDay(from)}--${isoDay(to)}.xml`
  try {
    const response = await fetch(url, { signal })
    if (!response.ok) return null
    return parseLatestDate(await response.text())
  } catch {
    return null
  }
}

// <Domain>2026-09-01/2026-09-28/P1D,2026-09-30/2026-09-30/P1D</Domain> → "2026-09-30"
export function parseLatestDate(xml: string): string | null {
  const domain = xml.match(/<Domain>([^<]+)<\/Domain>/)?.[1]
  const last = domain?.split(',').pop()?.split('/')
  const day = last?.[1] ?? last?.[0]
  return day && /^\d{4}-\d{2}-\d{2}/.test(day) ? day.slice(0, 10) : null
}
