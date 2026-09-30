import { describe, expect, it } from 'vitest'
import type { ObservationPoint } from '@/types/api'
import { greennessSummary, greennessWord, isoDaysBefore, rainSummary, wetnessWord } from './insights'
import { missionState, MISSIONS } from './missions'
import type { SourceStatus } from '@/types/api'

const pt = (date: string, value: number, quality: ObservationPoint['quality'] = 'good'): ObservationPoint => ({
  date,
  value,
  source: 'x',
  quality,
})

describe('insights', () => {
  it('subtracts calendar days without drifting across time zones', () => {
    expect(isoDaysBefore('2026-09-30', 7)).toBe('2026-09-23')
    expect(isoDaysBefore('2026-03-01', 1)).toBe('2026-02-28')
    expect(isoDaysBefore('2026-01-01', 1)).toBe('2025-12-31')
  })

  it('summarises rainfall for the week and month', () => {
    const points = [pt('2026-08-20', 50), pt('2026-09-10', 28), pt('2026-09-25', 4), pt('2026-09-27', 6)]
    const summary = rainSummary(points, '2026-09-30')!
    expect(summary.week).toBe(10)
    expect(summary.month).toBe(38)
    expect(summary.wettest.date).toBe('2026-09-10')
    expect(rainSummary([], '2026-09-30')).toBeNull()
  })

  it('describes soil and plants in plain words', () => {
    expect(wetnessWord(0.82)).toBe('very wet')
    expect(wetnessWord(0.3)).toBe('dry')
    expect(greennessWord(-0.14)).toBe('Water or flooded')
    expect(greennessWord(0.72)).toBe('Lush and green')
  })

  it('compares the last clear view with the seasonal normal', () => {
    const normal = [pt('2026-06-01', 0.6), pt('2026-09-01', 0.9)]
    expect(greennessSummary([pt('2026-06-02', 0.7)], normal, '2026-06-10')?.comparison).toBe('greener than normal')
    expect(greennessSummary([pt('2026-06-02', 0.62)], normal, '2026-06-10')?.comparison).toBe('about normal')
    expect(greennessSummary([pt('2026-06-02', 0.4)], normal, '2026-06-10')?.comparison).toBe('less green than normal')
  })

  it('recognises a flooded field and the monsoon cloud gap', () => {
    const summary = greennessSummary([pt('2026-08-05', -0.14, 'marginal')], [pt('2026-08-05', 0.2)], '2026-09-30')!
    expect(summary.comparison).toBe('the field was under water')
    expect(summary.cloudGapDays).toBe(56)
    expect(greennessSummary([], [], '2026-09-30')).toBeNull()
  })
})

const source = (id: string, state: SourceStatus['state']): SourceStatus => ({
  id,
  mission: '',
  provider: '',
  product: '',
  variables: [],
  requires_token: false,
  note: '',
  state,
  message: null,
  last_success: null,
  observations: 0,
  rejected: 0,
})

describe('missionState', () => {
  const smap = MISSIONS.find((m) => m.id === 'SMAP')!
  const viirs = MISSIONS.find((m) => m.id === 'VIIRS')!

  it('uses the stand-in when the mission needs a token', () => {
    expect(missionState(smap, [source('smap', 'needs_token'), source('nasa_power', 'ok')])).toBe('stand-in')
    expect(missionState(smap, [source('smap', 'needs_token'), source('nasa_power', 'error')])).toBe('problem')
  })

  it('reports live, baseline, problem and waiting', () => {
    expect(missionState(smap, [source('smap', 'ok')])).toBe('live')
    expect(missionState(viirs, [source('viirs', 'ok')])).toBe('baseline')
    expect(missionState(viirs, [source('viirs', 'error')])).toBe('problem')
    expect(missionState(viirs, [source('viirs', 'pending')])).toBe('waiting')
    expect(missionState(viirs, [])).toBe('waiting')
  })
})
