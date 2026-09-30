import { describe, expect, it } from 'vitest'
import { clampScore, RISK_LEVELS, riskMeta, scoreToLevel } from './risk'

describe('scoreToLevel', () => {
  it.each([
    [0, 'safe'],
    [24.9, 'safe'],
    [25, 'watch'],
    [49, 'watch'],
    [50, 'warning'],
    [74, 'warning'],
    [75, 'danger'],
    [100, 'danger'],
  ])('maps %s to %s', (score, level) => {
    expect(scoreToLevel(score)).toBe(level)
  })

  it('clamps out-of-range and invalid scores', () => {
    expect(scoreToLevel(-20)).toBe('safe')
    expect(scoreToLevel(180)).toBe('danger')
    expect(clampScore(Number.NaN)).toBe(0)
  })
})

describe('riskMeta', () => {
  it('has English and Bengali copy for every level', () => {
    for (const level of RISK_LEVELS) {
      expect(riskMeta[level].label).toBeTruthy()
      expect(riskMeta[level].labelBn).toMatch(/[ঀ-৿]/)
      expect(riskMeta[level].messageBn).toMatch(/[ঀ-৿]/)
    }
  })
})
