import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'
import type { GridCell } from '@/types/api'
import bangladesh from './data/bangladesh.geo.json'
import { DIVISIONS, type Place } from './places'

export const BANGLADESH = bangladesh as Feature<MultiPolygon | Polygon>

const polygons: Position[][][] =
  BANGLADESH.geometry.type === 'MultiPolygon' ? BANGLADESH.geometry.coordinates : [BANGLADESH.geometry.coordinates]

// Ray casting: is [lon, lat] inside this ring?
function inRing([x, y]: Position, ring: Position[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function isInBangladesh(lon: number, lat: number) {
  const point = [lon, lat]
  return polygons.some(([outer, ...holes]) => inRing(point, outer) && !holes.some((hole) => inRing(point, hole)))
}

export interface CellProperties extends GridCell {
  id: number
}

/**
 * Grid cells → square polygons. Cells whose centre falls outside Bangladesh are dropped,
 * so the overlay follows the country's shape.
 */
export function cellsToGeoJSON(cells: GridCell[], cellSize: number): FeatureCollection<Polygon, CellProperties> {
  const h = cellSize / 2
  const features = cells
    .filter((c) => isInBangladesh(c.lon, c.lat))
    .map((c, id) => ({
      type: 'Feature' as const,
      id,
      properties: { ...c, id },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [c.lon - h, c.lat - h],
            [c.lon + h, c.lat - h],
            [c.lon + h, c.lat + h],
            [c.lon - h, c.lat + h],
            [c.lon - h, c.lat - h],
          ],
        ],
      },
    }))
  return { type: 'FeatureCollection', features }
}

// The grid cell containing a point, or null if none does.
export function findCell(cells: GridCell[], cellSize: number, lon: number, lat: number) {
  const h = cellSize / 2
  return cells.find((c) => Math.abs(c.lon - lon) <= h && Math.abs(c.lat - lat) <= h) ?? null
}

// Great-circle distance in km.
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(s))
}

export function nearestPlace(lat: number, lon: number, places: Place[] = DIVISIONS) {
  let best = places[0]
  let bestKm = Infinity
  for (const place of places) {
    const km = distanceKm({ lat, lon }, place)
    if (km < bestKm) {
      best = place
      bestKm = km
    }
  }
  return { place: best, km: Math.round(bestKm) }
}

export function formatLatLon(lat: number, lon: number) {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`
}
