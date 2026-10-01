import { useReducedMotion } from 'framer-motion'
import { AttributionControl, type GeoJSONSource, Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl'
import './maplibre-setup'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { riskMeta, scoreToLevel } from '@/lib/risk'
import type { MapOverview, RiskModule } from '@/types/api'
import { ATTRIBUTION, type BasemapId, basemaps } from './basemaps'
import { BANGLADESH, type CellProperties, cellsToGeoJSON } from './geo'
import { baseLayerId, buildStyle, riskFillColor } from './map-style'
import { BANGLADESH_CENTER, DIVISIONS } from './places'

export interface LngLat {
  lng: number
  lat: number
}

// A fly-to request. `key` changes on every request, so flying to the same place twice works.
export type MapFocus = { center: [number, number]; zoom: number; key: number } | { home: true; key: number }

interface MapCanvasProps {
  overview: MapOverview
  layer: RiskModule
  basemap: BasemapId
  selectedFarmId: string | null
  picked: LngLat | null
  focus: MapFocus | null
  onPickLocation: (point: LngLat) => void
  onPickFarm: (farmId: string) => void
  onError: (message: string) => void
  renderFarmMarker: (farmId: string) => ReactNode
  className?: string
}

const HOME_ZOOM = 6.3
const BANGLADESH_BOUNDS: [[number, number], [number, number]] = [
  [88.0, 20.7],
  [92.7, 26.65],
]

function homePadding(container: HTMLElement) {
  const wide = container.clientWidth >= 640
  return { top: 24, bottom: 24, left: wide ? 290 : 24, right: wide ? 40 : 24 }
}
const FILL_A = 'risk-fill-a'
const FILL_B = 'risk-fill-b'

// Creates one DOM element per key, kept for the component's lifetime (marker hosts).
function useElementPool() {
  const [pool] = useState(() => new Map<string, HTMLDivElement>())
  return useCallback(
    (key: string) => {
      let el = pool.get(key)
      if (!el) {
        el = document.createElement('div')
        pool.set(key, el)
      }
      return el
    },
    [pool],
  )
}

/**
 * Imperative MapLibre wrapper. React owns the state; this component mirrors it onto the
 * map: the cross-fading risk layers, basemap fades, markers (rendered via portals), the
 * hover tooltip and fly-to animations.
 */
export function MapCanvas({
  overview,
  layer,
  basemap,
  selectedFarmId,
  picked,
  focus,
  onPickLocation,
  onPickFarm,
  onError,
  renderFarmMarker,
  className,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const [hover, setHover] = useState<{ x: number; y: number; cell: CellProperties } | null>(null)
  const reduceMotion = useReducedMotion()
  const element = useElementPool()

  const grid = useMemo(() => cellsToGeoJSON(overview.cells, overview.cell_size_deg), [overview])
  const baseList = useMemo(() => basemaps(), [])

  // Latest values for map event handlers registered once at init.
  const live = useRef({ layer, onPickLocation, onPickFarm, onError, basemap })
  useEffect(() => {
    live.current = { layer, onPickLocation, onPickFarm, onError, basemap }
  })

  // --- init -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container,
        style: buildStyle(baseList, live.current.basemap),
        center: BANGLADESH_CENTER,
        // Start far out and fly in: the "satellite zooming down" moment.
        zoom: reduceMotion ? HOME_ZOOM : 3.2,
        minZoom: 3,
        maxZoom: 10,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
      })
    } catch (error) {
      live.current.onError(error instanceof Error ? error.message : 'Map could not start')
      return
    }
    mapRef.current = map
    map.touchZoomRotate.disableRotation()
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new AttributionControl({ compact: true, customAttribution: ATTRIBUTION }), 'bottom-right')
    map.getCanvas().setAttribute('aria-label', 'Risk map of Bangladesh. Use arrow keys to pan and plus or minus to zoom.')

    const markers: Marker[] = []

    map.on('load', () => {
      map.addSource('grid', { type: 'geojson', data: grid })
      map.addSource('bangladesh', { type: 'geojson', data: BANGLADESH })

      // Two fill layers so switching risk layers can cross-fade (MapLibre can't tween
      // data-driven colors). Front layer starts invisible and fades in after the fly-in.
      for (const id of [FILL_A, FILL_B]) {
        map.addLayer({
          id,
          type: 'fill',
          source: 'grid',
          paint: {
            'fill-color': riskFillColor(live.current.layer),
            'fill-opacity': 0,
            'fill-opacity-transition': { duration: 700, delay: 0 },
            'fill-antialias': false,
          },
        })
      }
      map.addLayer({
        id: 'risk-outline',
        type: 'line',
        source: 'grid',
        paint: {
          'line-color': '#ffffff',
          'line-width': ['case', ['boolean', ['feature-state', 'picked'], false], 2.5, 1.5],
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'picked'], false],
            1,
            ['boolean', ['feature-state', 'hover'], false],
            0.8,
            0,
          ],
        },
      })
      map.addLayer({
        id: 'bangladesh-glow',
        type: 'line',
        source: 'bangladesh',
        paint: { 'line-color': '#4ade80', 'line-width': 8, 'line-opacity': 0.15, 'line-blur': 6 },
      })
      map.addLayer({
        id: 'bangladesh-outline',
        type: 'line',
        source: 'bangladesh',
        paint: { 'line-color': '#86efac', 'line-width': 1.5, 'line-opacity': 0.9 },
      })

      map.setPaintProperty(FILL_A, 'fill-opacity', 1)
      map.setPaintProperty(FILL_A, 'fill-opacity-transition', { duration: 1200, delay: reduceMotion ? 0 : 1800 })

      for (const place of DIVISIONS) {
        const el = element(`place-${place.name}`)
        markers.push(new Marker({ element: el, anchor: 'center' }).setLngLat([place.lon, place.lat]).addTo(map))
      }
      for (const farm of overview.farms) {
        const el = element(`farm-${farm.id}`)
        el.addEventListener('click', (event) => {
          event.stopPropagation()
          live.current.onPickFarm(farm.id)
        })
        markers.push(new Marker({ element: el, anchor: 'center' }).setLngLat([farm.lon, farm.lat]).addTo(map))
      }

      // Fit the whole country, leaving room for the legend on wider screens.
      map.fitBounds(BANGLADESH_BOUNDS, {
        padding: homePadding(container),
        duration: reduceMotion ? 0 : 2600,
        linear: false,
        curve: 1.5,
        essential: true,
      })
      setReady(true)
    })

    // Hover: outline the cell and show a tooltip. Click anywhere: pick that location.
    let hoveredId: number | null = null
    const clearHover = () => {
      if (hoveredId !== null) map.setFeatureState({ source: 'grid', id: hoveredId }, { hover: false })
      hoveredId = null
      setHover(null)
    }
    map.on('mousemove', FILL_A, (event) => {
      const feature = event.features?.[0]
      if (!feature) return
      const id = feature.id as number
      if (id !== hoveredId) {
        if (hoveredId !== null) map.setFeatureState({ source: 'grid', id: hoveredId }, { hover: false })
        map.setFeatureState({ source: 'grid', id }, { hover: true })
        hoveredId = id
      }
      map.getCanvas().style.cursor = 'pointer'
      setHover({ x: event.point.x, y: event.point.y, cell: feature.properties as CellProperties })
    })
    map.on('mouseleave', FILL_A, () => {
      map.getCanvas().style.cursor = ''
      clearHover()
    })
    map.on('click', (event) => live.current.onPickLocation({ lng: event.lngLat.lng, lat: event.lngLat.lat }))
    // Missing tiles are not fatal: the outline and risk grid still work without imagery.
    map.on('error', (event) => console.warn('[map]', event.error?.message ?? event))

    return () => {
      markers.forEach((m) => m.remove())
      map.remove()
      mapRef.current = null
      setReady(false)
    }
    // The map is created once. Later prop changes are applied by the effects below;
    // re-creating the WebGL map on every data change would replay the fly-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- grid data (e.g. after a refresh) ---------------------------------------------
  useEffect(() => {
    if (!ready) return
    ;(mapRef.current?.getSource('grid') as GeoJSONSource | undefined)?.setData(grid)
  }, [grid, ready])

  // --- risk layer cross-fade --------------------------------------------------------
  const front = useRef(FILL_A)
  const shownLayer = useRef(layer)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || shownLayer.current === layer) return
    const back = front.current === FILL_A ? FILL_B : FILL_A
    map.setPaintProperty(back, 'fill-color', riskFillColor(layer))
    map.setPaintProperty(back, 'fill-opacity-transition', { duration: reduceMotion ? 0 : 700, delay: 0 })
    map.setPaintProperty(front.current, 'fill-opacity-transition', { duration: reduceMotion ? 0 : 700, delay: 0 })
    map.setPaintProperty(back, 'fill-opacity', 1)
    map.setPaintProperty(front.current, 'fill-opacity', 0)
    // Hover events follow whichever layer is in front.
    map.moveLayer(back, 'risk-outline')
    front.current = back
    shownLayer.current = layer
  }, [layer, ready, reduceMotion])

  // --- basemap fade ------------------------------------------------------------------
  const shownBase = useRef(basemap)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || shownBase.current === basemap) return
    const previous = baseLayerId(shownBase.current)
    const next = baseLayerId(basemap)
    map.setLayoutProperty(next, 'visibility', 'visible')
    map.setPaintProperty(next, 'raster-opacity', 1)
    map.setPaintProperty(previous, 'raster-opacity', 0)
    // Stop fetching tiles for the hidden basemap once it has faded out.
    const timer = setTimeout(() => {
      if (mapRef.current && shownBase.current !== previous.replace('base-', '')) {
        mapRef.current.setLayoutProperty(previous, 'visibility', 'none')
      }
    }, 700)
    shownBase.current = basemap
    return () => clearTimeout(timer)
  }, [basemap, ready])

  // --- fly-to requests ---------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !focus) return
    const duration = reduceMotion ? 0 : 1600
    if ('home' in focus) {
      const container = map.getContainer()
      map.fitBounds(BANGLADESH_BOUNDS, { padding: homePadding(container), duration, linear: false, essential: true })
    } else {
      map.flyTo({ center: focus.center, zoom: focus.zoom, duration, essential: true })
    }
  }, [focus, ready, reduceMotion])

  // --- picked location: pin marker + outlined cell -------------------------------------
  const pickedFeatureId = useMemo(() => {
    if (!picked) return null
    const h = overview.cell_size_deg / 2
    const f = grid.features.find((c) => Math.abs(c.properties.lon - picked.lng) <= h && Math.abs(c.properties.lat - picked.lat) <= h)
    return f ? f.properties.id : null
  }, [picked, grid, overview.cell_size_deg])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || pickedFeatureId === null) return
    map.setFeatureState({ source: 'grid', id: pickedFeatureId }, { picked: true })
    return () => {
      if (mapRef.current?.getSource('grid')) mapRef.current.setFeatureState({ source: 'grid', id: pickedFeatureId }, { picked: false })
    }
  }, [pickedFeatureId, ready])

  const pinMarker = useRef<Marker | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    if (!picked) {
      pinMarker.current?.remove()
      pinMarker.current = null
      return
    }
    const pin = pinMarker.current ?? new Marker({ element: element('pin'), anchor: 'bottom' })
    pinMarker.current = pin
    pin.setLngLat([picked.lng, picked.lat]).addTo(map)
  }, [picked, ready, element])

  const hoverLevel = hover ? scoreToLevel(hover.cell[layer]) : null

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Sized with h/w-full, not absolute positioning: maplibre-gl.css forces position: relative. */}
      <div ref={containerRef} className="h-full w-full" />

      {hover && hoverLevel && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg bg-night-900/95 px-2.5 py-1.5 text-center shadow-lg ring-1 ring-line-strong"
          style={{ left: hover.x, top: hover.y }}
        >
          <p className="text-sm font-bold text-ink">{hover.cell[layer]}</p>
          <p className="flex items-center gap-1.5 text-[11px] whitespace-nowrap text-ink-muted">
            <span className="size-2 rounded-full" style={{ backgroundColor: riskMeta[hoverLevel].color }} />
            {riskMeta[hoverLevel].label}
          </p>
        </div>
      )}

      {/* Marker contents are React, portalled into the elements MapLibre positions. */}
      {DIVISIONS.map((place) =>
        createPortal(
          <span className="pointer-events-none rounded bg-night-950/60 px-1.5 py-0.5 text-[11px] font-semibold text-ink/90 backdrop-blur-sm">
            {place.name}
          </span>,
          element(`place-${place.name}`),
          `place-${place.name}`,
        ),
      )}
      {overview.farms.map((farm) =>
        createPortal(
          <div data-selected={farm.id === selectedFarmId || undefined}>{renderFarmMarker(farm.id)}</div>,
          element(`farm-${farm.id}`),
          `farm-${farm.id}`,
        ),
      )}
      {createPortal(
        <div className="flex flex-col items-center" aria-hidden="true">
          <div className="grid size-8 place-items-center rounded-full rounded-br-none bg-white shadow-lg [transform:rotate(45deg)]">
            <div className="size-3 rounded-full bg-night-900" />
          </div>
        </div>,
        element('pin'),
        'pin',
      )}
    </div>
  )
}
