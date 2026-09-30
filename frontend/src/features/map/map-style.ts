import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import { RISK_HEX } from '@/lib/risk'
import type { RiskModule } from '@/types/api'
import type { Basemap, BasemapId } from './basemaps'

function withAlpha(hex: string, alpha: number) {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// Emphasis grows with risk: safe land is a faint wash, danger is nearly solid.
const LEVEL_ALPHA = { safe: 0.22, watch: 0.5, warning: 0.64, danger: 0.76 }

/** Same thresholds as lib/risk.ts: 0–24 safe · 25–49 watch · 50–74 warning · 75+ danger. */
export function riskFillColor(layer: RiskModule): ExpressionSpecification {
  return [
    'step',
    ['get', layer],
    withAlpha(RISK_HEX.safe, LEVEL_ALPHA.safe),
    25,
    withAlpha(RISK_HEX.watch, LEVEL_ALPHA.watch),
    50,
    withAlpha(RISK_HEX.warning, LEVEL_ALPHA.warning),
    75,
    withAlpha(RISK_HEX.danger, LEVEL_ALPHA.danger),
  ]
}

export const baseLayerId = (id: BasemapId) => `base-${id}`

// Only raster basemaps live in the style; risk layers are added on load.
export function buildStyle(list: Basemap[], active: BasemapId): StyleSpecification {
  return {
    version: 8,
    sources: Object.fromEntries(
      list.map((b) => [baseLayerId(b.id), { type: 'raster' as const, tiles: [b.tiles], tileSize: 256, maxzoom: b.maxzoom }]),
    ),
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#06120e' } },
      ...list.map((b) => ({
        id: baseLayerId(b.id),
        type: 'raster' as const,
        source: baseLayerId(b.id),
        layout: { visibility: b.id === active ? ('visible' as const) : ('none' as const) },
        paint: {
          'raster-opacity': b.id === active ? 1 : 0,
          'raster-opacity-transition': { duration: 600, delay: 0 },
          // Slightly muted so the risk overlay is the loudest thing on the map.
          'raster-saturation': b.id === 'night' ? 0 : -0.25,
          'raster-brightness-max': b.id === 'night' ? 1 : 0.8,
        },
      })),
    ],
  }
}
