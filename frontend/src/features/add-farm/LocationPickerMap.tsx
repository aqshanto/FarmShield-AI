import { useReducedMotion } from 'framer-motion'
import { AttributionControl, Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { useLang } from '@/lib/i18n'
import { ATTRIBUTION, basemaps } from '@/features/map/basemaps'
import { BANGLADESH } from '@/features/map/geo'
import { baseLayerId, buildStyle } from '@/features/map/map-style'
import { localizeMap } from '@/features/map/maplibre-setup'

export interface PickedPoint {
  lat: number
  lon: number
}

export type PickerFocus = PickedPoint & { zoom: number; key: number }

interface LocationPickerMapProps {
  value: PickedPoint | null
  focus: PickerFocus | null
  onPick: (point: PickedPoint) => void
  label: string
  viewLabels: { map: string; satellite: string }
}

type View = 'map' | 'satellite'
const OSM = 'osm'
// Street map with village names (in Bengali): what a farmer needs to find their own field.
// OpenStreetMap's tile policy allows light use like this with attribution.
const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'

function pickerStyle() {
  const style = buildStyle(basemaps().filter((b) => b.id === 'relief'), 'relief')
  style.sources[OSM] = { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19 }
  style.layers.push({ id: OSM, type: 'raster', source: OSM, paint: { 'raster-brightness-max': 0.92, 'raster-saturation': -0.1 } })
  return style
}

const BOUNDS: [[number, number], [number, number]] = [
  [88.0, 20.7],
  [92.7, 26.65],
]

function pinElement() {
  const el = document.createElement('div')
  el.className = 'farm-pin'
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML = `
    <span class="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 size-5 rounded-full bg-leaf-300/40 animate-ping-soft"></span>
    <svg viewBox="0 0 32 42" width="32" height="42" class="relative drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
      <path d="M16 41C16 41 3 26 3 16a13 13 0 0 1 26 0c0 10-13 25-13 25Z" fill="#4ade80" stroke="#052e16" stroke-width="2"/>
      <path d="M16 23c-1-5 1-9 6-10-1 5-3 8-6 10Zm0 0c0-4-2-7-6-8 0 4 2 7 6 8Z" fill="#052e16"/>
    </svg>`
  el.style.cursor = 'grab'
  return el
}

// A map of Bangladesh (street map or NASA satellite view): tap your field, or drag the pin.
export function LocationPickerMap({ value, focus, onPick, label, viewLabels }: LocationPickerMapProps) {
  const bn = useLang() === 'bn'
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const onPickRef = useRef(onPick)
  const reduce = useReducedMotion()
  const [view, setView] = useState<View>('map')
  useLayoutEffect(() => {
    onPickRef.current = onPick
  })

  useEffect(() => {
    if (!container.current) return
    const map = new MapLibreMap({
      container: container.current,
      style: pickerStyle(),
      bounds: BOUNDS,
      fitBoundsOptions: { padding: 16 },
      minZoom: 5,
      maxZoom: 16,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new AttributionControl({ compact: true, customAttribution: [OSM_ATTRIBUTION, ...ATTRIBUTION] }), 'bottom-left')
    map.on('load', () => {
      map.addSource('bangladesh', { type: 'geojson', data: BANGLADESH })
      map.addLayer({ id: 'bangladesh-line', type: 'line', source: 'bangladesh', paint: { 'line-color': '#86efac', 'line-width': 1.6, 'line-opacity': 0.85 } })
    })
    map.on('click', (e) => onPickRef.current({ lat: e.lngLat.lat, lon: e.lngLat.lng }))
    map.getCanvas().style.cursor = 'crosshair'
    mapRef.current = map
    return () => {
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Keep the pin on the chosen point; dragging it picks a new one.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!value) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    if (!markerRef.current) {
      const marker = new Marker({ element: pinElement(), draggable: true, anchor: 'bottom' }).setLngLat([value.lon, value.lat]).addTo(map)
      marker.on('dragend', () => {
        const p = marker.getLngLat()
        onPickRef.current({ lat: p.lat, lon: p.lng })
      })
      markerRef.current = marker
    } else {
      markerRef.current.setLngLat([value.lon, value.lat])
    }
  }, [value])

  // Street map or NASA satellite view.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      map.setLayoutProperty(OSM, 'visibility', view === 'map' ? 'visible' : 'none')
      map.setLayoutProperty(baseLayerId('relief'), 'visibility', view === 'satellite' ? 'visible' : 'none')
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [view])

  useEffect(() => {
    if (mapRef.current) localizeMap(mapRef.current, bn ? 'bn' : 'en', label)
  }, [bn, label])

  useEffect(() => {
    if (focus) mapRef.current?.flyTo({ center: [focus.lon, focus.lat], zoom: focus.zoom, duration: reduce ? 0 : 1400, essential: true })
  }, [focus, reduce])

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" role="application" aria-label={label} />
      <div className="absolute top-3 left-3 z-10 flex rounded-full bg-night-950/80 p-1 backdrop-blur" role="group" aria-label={bn ? 'মানচিত্রের ধরন' : 'Map view'}>
        {(['map', 'satellite'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={cn(
              'focus-ring cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              view === v ? 'bg-leaf-400 text-night-950' : 'text-ink-muted hover:text-ink',
            )}
          >
            {viewLabels[v]}
          </button>
        ))}
      </div>
    </div>
  )
}
