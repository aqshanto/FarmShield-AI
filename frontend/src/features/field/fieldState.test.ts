import { describe, expect, it } from 'vitest'
import { makeDashboard } from '@/test/fixtures'
import type { Dashboard } from '@/types/api'
import { fieldCrop, fieldState, floodWater, PADDY_WATER, stageLabel, todayScores, trendScores } from './fieldState'

const scores = (flood_risk: number, water_stress: number, crop_health: number) => ({ flood_risk, water_stress, crop_health })

function withCrop(crop: string, extra: Partial<Dashboard> = {}): Dashboard {
  const d = makeDashboard()
  return { ...d, farm: { ...d.farm, crop }, ...extra }
}

describe('fieldCrop', () => {
  it('recognises the farm crops', () => {
    expect(fieldCrop('Boro rice')).toBe('rice')
    expect(fieldCrop('Potato')).toBe('potato')
    expect(fieldCrop('Wheat')).toBe('wheat')
    expect(fieldCrop('Aman rice')).toBe('rice')
    expect(fieldCrop('Maize')).toBe('wheat') // tall crops draw as stalks
    expect(fieldCrop('Jute')).toBe('wheat')
    expect(fieldCrop('Lentil')).toBe('potato') // low leafy crops draw as bushes
    expect(fieldCrop('Tomato')).toBe('potato')
  })
})

describe('floodWater', () => {
  it('keeps a dry upland field dry when flood risk is safe, and covers it at danger', () => {
    expect(floodWater(24, 'wheat')).toBe(0) // safe means a dry field: no puddles
    expect(floodWater(40, 'wheat')).toBeGreaterThan(0)
    expect(floodWater(60, 'wheat')).toBeGreaterThan(0.1)
    expect(floodWater(60, 'wheat')).toBeLessThan(0.8) // between the rows, not over the plants
    expect(floodWater(80, 'wheat')).toBeGreaterThan(0.8)
    expect(floodWater(100, 'potato')).toBeGreaterThan(1) // under water
  })

  it('gives a safe rice paddy its normal shallow water, unless the soil is drying', () => {
    expect(floodWater(0, 'rice')).toBeCloseTo(PADDY_WATER)
    expect(floodWater(0, 'rice', 0.6)).toBe(0) // dry paddy, no standing water
    expect(floodWater(40, 'rice', 0.6)).toBeGreaterThan(PADDY_WATER) // a flood refills it
    expect(floodWater(80, 'rice')).toBeGreaterThan(0.95) // danger: at or over the plant tops
  })

  it('rises steadily with the score', () => {
    for (const crop of ['rice', 'wheat'] as const) {
      const levels = [0, 20, 40, 60, 80, 100].map((s) => floodWater(s, crop))
      expect([...levels].sort((a, b) => a - b)).toEqual(levels)
    }
  })
})

describe('fieldState', () => {
  it('shows every risk together, or only the focused one', () => {
    const d = withCrop('Wheat')
    const all = fieldState(d, scores(80, 70, 60))
    expect(all.water).toBeGreaterThan(0.8)
    expect(all.dryness).toBeGreaterThan(0.6)
    expect(all.sickness).toBeGreaterThan(0.4)

    const waterOnly = fieldState(d, scores(80, 70, 60), 'water_stress')
    expect(waterOnly.water).toBe(0)
    expect(waterOnly.sickness).toBe(0)
    expect(waterOnly.dryness).toBe(all.dryness)
  })

  it('adds today’s heat, disease, rain and cloud signals only when asked', () => {
    const base = makeDashboard()
    const modules = base.modules.map((m) =>
      m.id === 'crop_health'
        ? {
            ...m,
            factors: [
              { id: 'heat', label: 'Heat stress', score: 80, weight: 0.15, detail: '', source: '' },
              { id: 'disease', label: 'Disease weather', score: 40, weight: 0.1, detail: '', source: '' },
            ],
            indicators: { crop: 'rice', greenness: 0.6, greenness_normal: 0.7, last_clear_view: '2026-06-10', cloud_gap_days: 110, heat_days: 8, heat_limit_c: 35, disease: 'blast', disease_days: 3 },
          }
        : m,
    )
    const d = { ...base, modules }
    const today = fieldState(d, todayScores(d))
    expect(today.heat).toBe(0.8)
    expect(today.disease).toBe(0.4)
    expect(today.rain).toBeGreaterThan(0.5) // 106 mm in the fixture's first 3 days
    expect(today.hiddenByClouds).toBe(true)

    const replay = fieldState(d, todayScores(d), 'all', false)
    expect([replay.heat, replay.disease, replay.rain, replay.hiddenByClouds]).toEqual([0, 0, 0, false])
  })
})

describe('trendScores', () => {
  it('lines up the three 14-day trends, oldest first, ending today', () => {
    const d = makeDashboard()
    const days = trendScores(d)
    expect(days).toHaveLength(14)
    expect(days[13]).toEqual(todayScores(d))
    expect(days[0]).toEqual(scores(22, 18, 22))
  })
})

describe('stageLabel', () => {
  it('describes the stage in the farmer’s language and for the crop', () => {
    expect(stageLabel('flood_risk', 'rice', 'safe', 'en')).toBe('Normal paddy water')
    expect(stageLabel('flood_risk', 'wheat', 'safe', 'en')).toBe('Dry field')
    expect(stageLabel('flood_risk', 'potato', 'danger', 'bn')).toBe('ফসল পানির নিচে')
    expect(stageLabel('water_stress', 'wheat', 'warning', 'en')).toBe('Cracked soil, leaves curling')
    expect(stageLabel('crop_health', 'rice', 'watch', 'bn')).toBe('কিছু পাতা হলুদ')
  })
})
