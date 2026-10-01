import type { Lang } from '@/lib/i18n'
import { type RiskLevel, RISK_LEVELS } from '@/lib/risk'
import type { Dashboard, RiskModule } from '@/types/api'

// Turns risk scores into what a picture of the field should show. Pure functions, so the
// scene stays a dumb renderer and every rule here is unit-tested.

export type FieldCrop = 'rice' | 'wheat' | 'potato'
export type FieldFocus = 'all' | RiskModule

export function fieldCrop(crop: string): FieldCrop {
  const c = crop.toLowerCase()
  if (c.includes('rice') || c.includes('paddy')) return 'rice'
  if (c.includes('potato')) return 'potato'
  return 'wheat'
}

export const stageIndex = (level: RiskLevel) => RISK_LEVELS.indexOf(level)

/** Piecewise-linear through anchors at scores 0, 25, 50, 75, 100 (the level edges). */
function anchored(score: number, anchors: [number, number, number, number, number]) {
  const s = Math.min(100, Math.max(0, score)) / 25
  const i = Math.min(3, Math.floor(s))
  return anchors[i] + (anchors[i + 1] - anchors[i]) * (s - i)
}

/**
 * Water above the soil, as a fraction of plant height (1 = water at the plant tops).
 * Rice paddies normally hold a few centimetres of water, unless the soil is drying out.
 */
export function floodWater(floodScore: number, crop: FieldCrop, dryness = 0) {
  if (crop === 'rice') {
    // Normal paddy water drains away as the soil dries, but a rising flood refills it.
    const paddy = floodScore >= 25 ? PADDY_WATER : PADDY_WATER * Math.max(0, 1 - dryness * 2.5)
    return paddy + anchored(floodScore, [0, 0.06, 0.33, 0.83, 1.03])
  }
  // Puddles (watch) → water between rows (warning) → plants going under (danger).
  return anchored(floodScore, [0, 0, 0.1, 0.8, 1.15])
}

export const PADDY_WATER = 0.12

export const drynessOf = (waterScore: number) => anchored(waterScore, [0, 0.15, 0.45, 0.75, 1])
export const sicknessOf = (cropScore: number) => anchored(cropScore, [0, 0.12, 0.4, 0.68, 0.95])

export interface FieldState {
  crop: FieldCrop
  water: number // fraction of plant height, 0–1.15
  dryness: number // 0 moist … 1 deeply cracked
  sickness: number // 0 lush … 1 most plants brown
  heat: number // 0–1: sun glare and haze
  disease: number // 0–1: leaf spots
  rain: number // 0–1: forecast rain clouds
  hiddenByClouds: boolean // satellites haven't seen the field for weeks
}

export interface FieldScores {
  flood_risk: number
  water_stress: number
  crop_health: number
}

const factorScore = (d: Dashboard, module: RiskModule, id: string) =>
  d.modules.find((m) => m.id === module)?.factors.find((f) => f.id === id)?.score ?? 0

const moduleScore = (d: Dashboard, module: RiskModule) => d.modules.find((m) => m.id === module)?.score ?? 0

export function todayScores(d: Dashboard): FieldScores {
  return { flood_risk: moduleScore(d, 'flood_risk'), water_stress: moduleScore(d, 'water_stress'), crop_health: moduleScore(d, 'crop_health') }
}

/** Scores for each of the last 14 days, oldest first, from the modules' trends. */
export function trendScores(d: Dashboard): FieldScores[] {
  const trend = (id: RiskModule) => d.modules.find((m) => m.id === id)?.trend ?? []
  const days = Math.max(trend('flood_risk').length, trend('water_stress').length, trend('crop_health').length)
  return Array.from({ length: days }, (_, i) => ({
    flood_risk: trend('flood_risk')[i] ?? 0,
    water_stress: trend('water_stress')[i] ?? 0,
    crop_health: trend('crop_health')[i] ?? 0,
  }))
}

/**
 * What to draw. `focus` isolates one risk (the others show a calm field), and `extras`
 * adds today's heat, disease, rain and satellite signals (off when replaying the past).
 */
export function fieldState(d: Dashboard, scores: FieldScores, focus: FieldFocus = 'all', extras = true): FieldState {
  const crop = fieldCrop(d.farm.crop)
  const show = (m: RiskModule) => focus === 'all' || focus === m
  const dryness = show('water_stress') ? drynessOf(scores.water_stress) : 0
  const rain3 = d.forecast.slice(0, 3).reduce((sum, f) => sum + f.rain_mm, 0)
  const indicators = d.modules.find((m) => m.id === 'crop_health')?.indicators
  return {
    crop,
    water: show('flood_risk') ? floodWater(scores.flood_risk, crop, dryness) : floodWater(0, crop, dryness),
    dryness,
    sickness: show('crop_health') ? sicknessOf(scores.crop_health) : 0,
    heat: extras && show('crop_health') ? factorScore(d, 'crop_health', 'heat') / 100 : 0,
    disease: extras && show('crop_health') ? factorScore(d, 'crop_health', 'disease') / 100 : 0,
    rain: extras && show('flood_risk') ? Math.min(1, rain3 / 80) : 0,
    hiddenByClouds: extras && (indicators?.cloud_gap_days ?? 0) > 45,
  }
}

/** One risk at one score on an otherwise calm field: for the design-system gallery. */
export function previewState(crop: FieldCrop, module: RiskModule, score: number): FieldState {
  const dryness = module === 'water_stress' ? drynessOf(score) : 0
  return {
    crop,
    water: floodWater(module === 'flood_risk' ? score : 0, crop, dryness),
    dryness,
    sickness: module === 'crop_health' ? sicknessOf(score) : 0,
    heat: 0,
    disease: 0,
    rain: 0,
    hiddenByClouds: false,
  }
}

// --- words -----------------------------------------------------------------------------------

type StageWords = Record<Lang, [string, string, string, string]>

const STAGES: Record<'flood' | 'flood_rice' | 'water' | 'crop', StageWords> = {
  flood: {
    en: ['Dry field', 'Wet soil, small puddles', 'Water standing between rows', 'Crop under water'],
    bn: ['শুকনো জমি', 'ভেজা মাটি, ছোট ছোট জমা পানি', 'সারির মাঝে পানি জমে আছে', 'ফসল পানির নিচে'],
  },
  flood_rice: {
    en: ['Normal paddy water', 'Water rising', 'Water near the plant tops', 'Plants under water'],
    bn: ['ধানক্ষেতে স্বাভাবিক পানি', 'পানি বাড়ছে', 'পানি গাছের মাথার কাছে', 'গাছ পানির নিচে'],
  },
  water: {
    en: ['Moist soil', 'Topsoil drying', 'Cracked soil, leaves curling', 'Deep cracks, plants wilting'],
    bn: ['মাটি ভেজা', 'উপরের মাটি শুকাচ্ছে', 'মাটি ফাটছে, পাতা কুঁকড়ে যাচ্ছে', 'গভীর ফাটল, গাছ নেতিয়ে পড়ছে'],
  },
  crop: {
    en: ['Lush and green', 'Some yellow leaves', 'Yellow-brown patches', 'Many plants turning brown'],
    bn: ['সতেজ ও সবুজ', 'কিছু পাতা হলুদ', 'হলুদ-বাদামি ছোপ', 'অনেক গাছ বাদামি হয়ে যাচ্ছে'],
  },
}

export function stageWords(module: RiskModule, crop: FieldCrop, lang: Lang) {
  const key = module === 'flood_risk' ? (crop === 'rice' ? 'flood_rice' : 'flood') : module === 'water_stress' ? 'water' : 'crop'
  return STAGES[key][lang]
}

export function stageLabel(module: RiskModule, crop: FieldCrop, level: RiskLevel, lang: Lang) {
  return stageWords(module, crop, lang)[stageIndex(level)]
}

export const fieldText = {
  en: {
    title: 'My field today',
    subtitle: 'A picture of today’s risks from NASA data, not a photo.',
    all: 'All',
    flood_risk: 'Flood',
    water_stress: 'Water',
    crop_health: 'Crop',
    danger: 'Could be damaged. Act today.',
    play: 'Play last 2 weeks',
    pause: 'Pause',
    today: 'Today',
    daysAgo: (n: number) => (n === 1 ? 'Yesterday' : `${n} days ago`),
    day: 'Day',
    hidden: 'Clouds have hidden this field from satellites for weeks. Walk the field to check.',
    stageOf: (i: number) => `Stage ${i + 1} of 4`,
    rain: 'Rain on the way',
    heat: 'Very hot days',
    disease: 'Disease weather',
  },
  bn: {
    title: 'আজ আমার জমি',
    subtitle: 'নাসার তথ্য থেকে আজকের ঝুঁকির চিত্র, আসল ছবি নয়।',
    all: 'সব',
    flood_risk: 'বন্যা',
    water_stress: 'পানি',
    crop_health: 'ফসল',
    danger: 'ক্ষতি হতে পারে। আজই ব্যবস্থা নিন।',
    play: 'গত ২ সপ্তাহ দেখুন',
    pause: 'থামান',
    today: 'আজ',
    daysAgo: (n: number) => (n === 1 ? 'গতকাল' : `${String(n).replace(/\d/g, (x) => '০১২৩৪৫৬৭৮৯'[Number(x)])} দিন আগে`),
    day: 'দিন',
    hidden: 'কয়েক সপ্তাহ ধরে মেঘের কারণে উপগ্রহ এই জমি দেখতে পায়নি। নিজে জমি ঘুরে দেখুন।',
    stageOf: (i: number) => `ধাপ ${'১২৩৪'[i]} / ৪`,
    rain: 'বৃষ্টি আসছে',
    heat: 'খুব গরম দিন',
    disease: 'রোগের আবহাওয়া',
  },
} as const
