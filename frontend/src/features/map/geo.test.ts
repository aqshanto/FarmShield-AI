import { describe, expect, it } from 'vitest'
import { mapOverviewFixture } from '@/test/fixtures'
import { cellsToGeoJSON, distanceKm, findCell, formatLatLon, isInBangladesh, nearestPlace } from './geo'

describe('isInBangladesh', () => {
  it.each([
    ['Dhaka', 90.41, 23.81, true],
    ['Sylhet', 91.87, 24.89, true],
    ['Rajshahi', 88.6, 24.37, true],
    ['Kolkata, India', 88.36, 22.57, false],
    ['Bay of Bengal', 90.5, 20.9, false],
    ['Shillong, India', 91.88, 25.58, false],
  ])('%s → %s', (_, lon, lat, inside) => {
    expect(isInBangladesh(lon as number, lat as number)).toBe(inside)
  })
})

describe('cellsToGeoJSON', () => {
  const geo = cellsToGeoJSON(mapOverviewFixture.cells, 0.2)

  it('drops cells outside the country', () => {
    expect(geo.features).toHaveLength(2)
    expect(geo.features.some((f) => f.properties.lat === 20.9)).toBe(false)
  })

  it('builds closed squares centred on each cell, with stable ids', () => {
    const [first] = geo.features
    const ring = first.geometry.coordinates[0]
    expect(ring).toHaveLength(5)
    expect(ring[0]).toEqual(ring[4])
    const lons = ring.map((p) => p[0])
    expect(Math.max(...lons) - Math.min(...lons)).toBeCloseTo(0.2)
    expect(geo.features.map((f) => f.id)).toEqual([0, 1])
    expect(first.properties.flood_risk).toBe(12)
  })
})

describe('findCell', () => {
  it('finds the cell containing a point, or null', () => {
    expect(findCell(mapOverviewFixture.cells, 0.2, 88.56, 24.62)?.water_stress).toBe(82)
    expect(findCell(mapOverviewFixture.cells, 0.2, 92.5, 26.5)).toBeNull()
  })
})

describe('distances and names', () => {
  it('measures great-circle distance', () => {
    // Dhaka ↔ Chattogram is roughly 215 km as the crow flies.
    expect(distanceKm({ lat: 23.81, lon: 90.412 }, { lat: 22.357, lon: 91.783 })).toBeGreaterThan(200)
    expect(distanceKm({ lat: 23.81, lon: 90.412 }, { lat: 22.357, lon: 91.783 })).toBeLessThan(230)
  })

  it('names the nearest division', () => {
    expect(nearestPlace(24.62, 88.56)).toMatchObject({ place: { name: 'Rajshahi' } })
    expect(nearestPlace(23.81, 90.41).km).toBe(0)
  })

  it('formats coordinates for people', () => {
    expect(formatLatLon(24.619, 88.561)).toBe('24.62°N, 88.56°E')
  })
})
