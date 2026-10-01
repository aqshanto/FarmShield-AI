import { describe, expect, it } from 'vitest'
import { buildStyle } from './map-style'
import { basemaps } from './basemaps'
import { isNasaLayerId, NASA_LAYERS, nasaTileUrl, parseLatestDate } from './nasaLayers'

describe('NASA world layers', () => {
  it('ask GIBS for the newest picture of each layer', () => {
    expect(NASA_LAYERS.map((l) => l.gibs)).toEqual(['SMAP_L4_Analyzed_Surface_Soil_Moisture', 'IMERG_Precipitation_Rate', 'MODIS_Terra_NDVI_8Day'])
    expect(nasaTileUrl(NASA_LAYERS[0])).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/SMAP_L4_Analyzed_Surface_Soil_Moisture/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png',
    )
  })

  it('every layer explains itself in both languages', () => {
    for (const layer of NASA_LAYERS) {
      for (const lang of ['en', 'bn'] as const) expect(Object.values(layer.text[lang]).every(Boolean)).toBe(true)
      expect(layer.stops.length).toBeGreaterThanOrEqual(5)
    }
  })

  it('reads the newest day from a GIBS domain document', () => {
    expect(parseLatestDate('<Domain>2026-09-01/2026-09-28/P1D</Domain>')).toBe('2026-09-28')
    expect(parseLatestDate('<Domain>2026-09-01/2026-09-20/P1D,2026-09-22/2026-09-30/P1D</Domain>')).toBe('2026-09-30')
    expect(parseLatestDate('<Domain>2026-10-01T03:30:00Z</Domain>')).toBe('2026-10-01')
    expect(parseLatestDate('not xml')).toBeNull()
  })

  it('validates layer ids from the URL', () => {
    expect(isNasaLayerId('rain')).toBe(true)
    expect(isNasaLayerId('volcanoes')).toBe(false)
    expect(isNasaLayerId(null)).toBe(false)
  })

  it('sit in the style under the risk grid, hidden unless chosen', () => {
    const style = buildStyle(basemaps(), 'relief', 'green')
    const ids = style.layers.map((l) => l.id)
    expect(ids).toEqual(['background', 'base-relief', 'base-today', 'base-night', 'nasa-soil', 'nasa-rain', 'nasa-green'])
    const visible = style.layers.filter((l) => l.type === 'raster' && l.layout?.visibility === 'visible').map((l) => l.id)
    expect(visible).toEqual(['base-relief', 'nasa-green'])
  })
})
