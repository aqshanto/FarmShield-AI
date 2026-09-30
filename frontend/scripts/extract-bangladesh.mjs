// Extracts Bangladesh's outline from Natural Earth (via world-atlas, 1:10m) into a small
// bundled GeoJSON, so the map shows the country even without internet.
// Run: node scripts/extract-bangladesh.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'

const here = dirname(fileURLToPath(import.meta.url))
const topology = JSON.parse(readFileSync(join(here, '../node_modules/world-atlas/countries-10m.json'), 'utf8'))
const countries = feature(topology, topology.objects.countries)
const bangladesh = countries.features.find((f) => f.id === '050')
if (!bangladesh) throw new Error('Bangladesh (ISO 050) not found in world-atlas')

// ~100 m precision is plenty at country/district zoom and keeps the file small.
const round = (coords) => (typeof coords[0] === 'number' ? coords.map((c) => Math.round(c * 1000) / 1000) : coords.map(round))

const out = {
  type: 'Feature',
  properties: { name: 'Bangladesh', source: 'Natural Earth 1:10m via world-atlas' },
  geometry: { type: bangladesh.geometry.type, coordinates: round(bangladesh.geometry.coordinates) },
}

const target = join(here, '../src/features/map/data/bangladesh.geo.json')
writeFileSync(target, JSON.stringify(out))
const polygons = out.geometry.type === 'MultiPolygon' ? out.geometry.coordinates.length : 1
console.log(`Wrote ${target} (${polygons} polygons, ${JSON.stringify(out).length} bytes)`)
