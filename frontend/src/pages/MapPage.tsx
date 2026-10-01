import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CloudRain, Droplets, Layers, MapPinOff, Maximize, Moon, Mountain, RotateCw, Satellite, Sprout } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { OrbitLoader } from '@/components/ui/OrbitLoader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { type BasemapId, basemaps } from '@/features/map/basemaps'
import { ExplorePanel } from '@/features/map/ExplorePanel'
import { FarmMarker } from '@/features/map/FarmMarker'
import { findCell, isInBangladesh } from '@/features/map/geo'
import { type LngLat, MapCanvas, type MapFocus } from '@/features/map/MapCanvas'
import { MapLegend } from '@/features/map/MapLegend'
import { FarmPanel, LocationPanel } from '@/features/map/SpotPanels'
import { useMyMapFarms } from '@/features/farms/useMyMapFarms'
import { api } from '@/lib/api'
import { useMyFarms } from '@/lib/myFarms'
import { useAsync } from '@/lib/useAsync'
import type { RiskModule } from '@/types/api'

const LAYER_IDS: RiskModule[] = ['flood_risk', 'water_stress', 'crop_health']

const layerOptions = [
  { value: 'flood_risk', label: 'Flood', icon: <CloudRain className="size-4" aria-hidden="true" /> },
  { value: 'water_stress', label: 'Water', icon: <Droplets className="size-4" aria-hidden="true" /> },
  { value: 'crop_health', label: 'Crop', icon: <Sprout className="size-4" aria-hidden="true" /> },
] as const

const basemapIcons: Record<BasemapId, ReactNode> = {
  relief: <Mountain className="size-3.5" aria-hidden="true" />,
  today: <Satellite className="size-3.5" aria-hidden="true" />,
  night: <Moon className="size-3.5" aria-hidden="true" />,
}

export function MapPage() {
  const [params, setParams] = useSearchParams()
  const overview = useAsync('map', (signal) => api.mapOverview({ signal }))
  const reduceMotion = useReducedMotion()

  const layerParam = params.get('layer') as RiskModule | null
  const layer: RiskModule = layerParam && LAYER_IDS.includes(layerParam) ? layerParam : 'flood_risk'
  const farmId = params.get('farm')

  const [basemap, setBasemap] = useState<BasemapId>('relief')
  const [picked, setPicked] = useState<LngLat | null>(null)
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const baseList = useMemo(() => basemaps(), [])

  // The farmer's saved fields join the demo farms on the map.
  const mine = useMyFarms()
  const myMapFarms = useMyMapFarms(mine)
  const data = useMemo(
    () => (overview.data && myMapFarms.length ? { ...overview.data, farms: [...myMapFarms, ...overview.data.farms] } : overview.data),
    [overview.data, myMapFarms],
  )
  const farm = data?.farms.find((f) => f.id === farmId) ?? null
  const activeLayer = data?.layers.find((l) => l.id === layer)
  // Opening /map?farm=… flies straight to that farm; explicit requests (jumps, picks) win.
  const effectiveFocus = useMemo<MapFocus | null>(
    () => focus ?? (farm ? { center: [farm.lon, farm.lat], zoom: 8, key: 0 } : null),
    [focus, farm],
  )

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    // In-page state: update the URL without jumping to the top.
    setParams(next, { replace: true, preventScrollReset: true })
  }

  const flyTo = (lng: number, lat: number, zoom: number) => setFocus({ center: [lng, lat], zoom, key: Date.now() })

  const pickFarm = (id: string) => {
    const f = data?.farms.find((x) => x.id === id)
    if (!f) return
    setPicked(null)
    updateParams({ farm: id })
    flyTo(f.lon, f.lat, 8)
  }

  const pickLocation = (point: LngLat) => {
    setPicked(point)
    if (farmId) updateParams({ farm: null })
  }

  if (overview.status === 'error' && !data) {
    return (
      <div className="grid place-items-center py-20">
        <Card className="max-w-md space-y-4 p-8 text-center">
          <MapPinOff className="mx-auto size-10 text-ink-subtle" aria-hidden="true" />
          <h1 className="text-xl font-bold text-ink">We couldn’t load the map data</h1>
          <p className="text-ink-muted">The farm brain isn’t answering right now. Check that the backend is running, then try again.</p>
          <Button icon={<RotateCw className="size-4" />} onClick={overview.retry}>
            Try again
          </Button>
        </Card>
      </div>
    )
  }

  const cell = picked && data ? findCell(data.cells, data.cell_size_deg, picked.lng, picked.lat) : null

  return (
    <div className="space-y-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-[0.2em] text-leaf-300 uppercase">
            <Layers className="size-3.5" aria-hidden="true" /> Risk map
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Bangladesh from space</h1>
        </div>
        <SegmentedControl
          ariaLabel="Map layer"
          options={layerOptions}
          value={layer}
          onChange={(value) => updateParams({ layer: value === 'flood_risk' ? null : value })}
        />
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="glass relative h-[62vh] min-h-[420px] overflow-hidden rounded-[var(--radius-card)] lg:h-[calc(100vh-13rem)] lg:min-h-[560px]">
          {data && !mapError && (
            <MapCanvas
              className="absolute inset-0"
              overview={data}
              layer={layer}
              basemap={basemap}
              selectedFarmId={farm?.id ?? null}
              picked={picked}
              focus={effectiveFocus}
              onPickLocation={pickLocation}
              onPickFarm={pickFarm}
              onError={setMapError}
              renderFarmMarker={(id) => {
                const f = data.farms.find((x) => x.id === id)
                return f ? <FarmMarker farm={f} layer={layer} selected={id === farm?.id} /> : null
              }}
            />
          )}

          {!data && (
            <div className="grid h-full place-items-center">
              <OrbitLoader label="Downloading the latest satellite picture…" />
            </div>
          )}

          {mapError && (
            <div className="grid h-full place-items-center p-6 text-center">
              <div className="max-w-sm space-y-2">
                <MapPinOff className="mx-auto size-8 text-ink-subtle" aria-hidden="true" />
                <p className="font-semibold text-ink">This device can’t show the interactive map</p>
                <p className="text-sm text-ink-muted">You can still explore your farms and their risks in the panel.</p>
              </div>
            </div>
          )}

          {/* "Satellite pass" sweep whenever the layer changes. */}
          {!reduceMotion && data && (
            <motion.div
              key={layer}
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 z-10 w-40 bg-gradient-to-r from-transparent via-sky-300/25 to-transparent"
              initial={{ left: '-10rem' }}
              animate={{ left: '100%' }}
              transition={{ duration: 1.1, ease: 'easeInOut' }}
            />
          )}

          {activeLayer && data && (
            <div className="absolute top-3 left-3 z-10 hidden sm:block">
              <MapLegend layer={activeLayer} />
            </div>
          )}

          {data && !mapError && (
            <button
              type="button"
              onClick={() => setFocus({ home: true, key: Date.now() })}
              className="focus-ring glass absolute bottom-3 left-3 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-night-900/85 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface-3 active:scale-95"
            >
              <Maximize className="size-3.5" aria-hidden="true" /> Whole country
            </button>
          )}

          {data && !mapError && (
            <div className="absolute top-3 right-3 z-10">
              <SegmentedControl
                ariaLabel="Background imagery"
                size="sm"
                value={basemap}
                onChange={setBasemap}
                className="bg-night-900/85"
                options={baseList.map((b) => ({ value: b.id, label: b.label, icon: basemapIcons[b.id] }))}
              />
            </div>
          )}
        </div>

        <Card className="p-5 lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto">
          {activeLayer && data && (
            <div className="mb-5 sm:hidden">
              <MapLegend layer={activeLayer} />
            </div>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={farm ? `farm-${farm.id}` : picked ? `spot-${picked.lng}-${picked.lat}` : 'explore'}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {data && farm ? (
                <FarmPanel
                  farm={farm}
                  layers={data.layers}
                  layer={layer}
                  onSelectLayer={(l) => updateParams({ layer: l === 'flood_risk' ? null : l })}
                  onClose={() => updateParams({ farm: null })}
                />
              ) : data && picked ? (
                <LocationPanel
                  point={picked}
                  cell={cell}
                  inCountry={isInBangladesh(picked.lng, picked.lat)}
                  layers={data.layers}
                  layer={layer}
                  onSelectLayer={(l) => updateParams({ layer: l === 'flood_risk' ? null : l })}
                  onClose={() => setPicked(null)}
                />
              ) : data ? (
                <ExplorePanel
                  farms={data.farms}
                  layer={layer}
                  onPickFarm={pickFarm}
                  onJump={(place) => {
                    setPicked({ lng: place.lon, lat: place.lat })
                    flyTo(place.lon, place.lat, 7.5)
                  }}
                />
              ) : (
                <p className="text-sm text-ink-muted">Loading…</p>
              )}
            </motion.div>
          </AnimatePresence>
        </Card>
      </div>

      <p className="text-xs text-ink-subtle">
        Background: {baseList.find((b) => b.id === basemap)?.description}. Risk layer: 0.2° grid (~20 km).
      </p>
    </div>
  )
}
