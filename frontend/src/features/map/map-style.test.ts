import { describe, expect, it } from 'vitest'
import { RISK_HEX, scoreToLevel } from '@/lib/risk'
import css from '@/styles/index.css?raw'
import { basemaps, modisDate } from './basemaps'
import { buildStyle, riskFillColor } from './map-style'

// Evaluates a MapLibre ['step', ['get', key], c0, t1, c1, …] expression for one value.
function evalStep(expr: unknown[], value: number) {
  const [, , first, ...rest] = expr as [string, unknown, string, ...(number | string)[]]
  let color = first
  for (let i = 0; i < rest.length; i += 2) if (value >= (rest[i] as number)) color = rest[i + 1] as string
  return color
}

const rgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

describe('riskFillColor', () => {
  it('uses the same thresholds and colors as the rest of the app', () => {
    const expr = riskFillColor('flood_risk')
    for (const score of [0, 12, 24, 25, 40, 49, 50, 74, 75, 100]) {
      expect(evalStep(expr, score)).toContain(rgb(RISK_HEX[scoreToLevel(score)]))
    }
  })

  it('reads the requested layer from each cell', () => {
    expect(riskFillColor('water_stress')[1]).toEqual(['get', 'water_stress'])
  })

  it('makes higher risk more opaque', () => {
    const expr = riskFillColor('crop_health')
    const alpha = (s: number) => Number(evalStep(expr, s).match(/([\d.]+)\)$/)?.[1])
    expect(alpha(10)).toBeLessThan(alpha(30))
    expect(alpha(30)).toBeLessThan(alpha(60))
    expect(alpha(60)).toBeLessThan(alpha(90))
  })
})

describe('RISK_HEX', () => {
  it('matches the --color-risk-* tokens in index.css', () => {
    for (const [level, hex] of Object.entries(RISK_HEX)) {
      expect(css).toContain(`--color-risk-${level}: ${hex};`)
    }
  })
})

describe('basemaps', () => {
  it('uses yesterday (UTC) for the MODIS image', () => {
    const now = new Date('2026-10-01T02:00:00Z')
    expect(modisDate(now)).toBe('2026-09-30')
    expect(basemaps(now).find((b) => b.id === 'today')?.tiles).toContain('/2026-09-30/')
  })

  it('only shows the active basemap in the initial style', () => {
    const style = buildStyle(basemaps(), 'night')
    const visible = style.layers.filter((l) => l.type === 'raster' && l.layout?.visibility === 'visible').map((l) => l.id)
    expect(visible).toEqual(['base-night'])
    expect(Object.keys(style.sources)).toEqual(['base-relief', 'base-today', 'base-night', 'nasa-soil', 'nasa-rain', 'nasa-green'])
  })
})
