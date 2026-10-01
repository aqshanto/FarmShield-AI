import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CloudRain, Droplets, Globe2, Layers, MapPinOff, Maximize, Moon, Mountain, RotateCw, Satellite, Sprout } from 'lucide-react'
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
import { NasaLayerPicker, NasaLegend } from '@/features/map/NasaLayerControls'
import { isNasaLayerId, type NasaLayerId } from '@/features/map/nasaLayers'
import { FarmPanel, LocationPanel } from '@/features/map/SpotPanels'
import { type WorldCrop, WorldSpotPanel } from '@/features/map/WorldSpotPanel'
import { useMyMapFarms } from '@/features/farms/useMyMapFarms'
import { api } from '@/lib/api'
import { useLang, useText } from '@/lib/i18n'
import { useMyFarms } from '@/lib/myFarms'
import { useAsync } from '@/lib/useAsync'
import type { RiskModule } from '@/types/api'

const LAYER_IDS: RiskModule[] = ['flood_risk', 'water_stress', 'crop_health']

const LAYER_ICONS = {
  flood_risk: <CloudRain className="size-4" aria-hidden="true" />,
  water_stress: <Droplets className="size-4" aria-hidden="true" />,
  crop_health: <Sprout className="size-4" aria-hidden="true" />,
}

const text = {
  en: {
    layers: { flood_risk: 'Flood', water_stress: 'Water', crop_health: 'Crop' },
    loadFailed: 'We couldn’t load the map data',
    downHint: 'The farm brain isn’t answering right now. Check that the backend is running, then try again.',
    retry: 'Try again',
    eyebrow: 'Risk map',
    title: 'Bangladesh and the world, from space',
    layerLabel: 'Map layer',
    downloading: 'Downloading the latest satellite picture…',
    loading: 'Loading…',
    footer: (bg: string) => `Background: ${bg}. Risk layer: 0.2° grid (~20 km).`,
    noMap: 'This device can’t show the interactive map',
    noMapHint: 'You can still explore your farms and their risks in the panel.',
    wholeCountry: 'Whole country',
    wholeWorld: 'Whole world',
    imagery: 'Background imagery',
  },
  bn: {
    layers: { flood_risk: 'বন্যা', water_stress: 'পানি', crop_health: 'ফসল' },
    loadFailed: 'মানচিত্রের তথ্য লোড করা যায়নি',
    downHint: 'এখন সার্ভার উত্তর দিচ্ছে না। ব্যাকএন্ড চালু আছে কি না দেখে আবার চেষ্টা করুন।',
    retry: 'আবার চেষ্টা করুন',
    eyebrow: 'ঝুঁকির মানচিত্র',
    title: 'মহাকাশ থেকে বাংলাদেশ ও বিশ্ব',
    layerLabel: 'মানচিত্রের স্তর',
    downloading: 'সর্বশেষ উপগ্রহ ছবি নামানো হচ্ছে…',
    loading: 'লোড হচ্ছে…',
    footer: (bg: string) => `পটভূমি: ${bg}। ঝুঁকির স্তর: ০.২° ঘর (প্রায় ২০ কিমি)।`,
    noMap: 'এই ডিভাইসে মানচিত্র দেখানো যাচ্ছে না',
    noMapHint: 'তবুও পাশের অংশে আপনার খামার আর ঝুঁকি দেখতে পারবেন।',
    wholeCountry: 'পুরো দেশ',
    wholeWorld: 'পুরো পৃথিবী',
    imagery: 'পটভূমির ছবি',
  },
}

const mapButton =
  'focus-ring glass inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-night-900/85 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface-3 active:scale-95'

const basemapIcons: Record<BasemapId, ReactNode> = {
  relief: <Mountain className="size-3.5" aria-hidden="true" />,
  today: <Satellite className="size-3.5" aria-hidden="true" />,
  night: <Moon className="size-3.5" aria-hidden="true" />,
}

export function MapPage() {
  const [params, setParams] = useSearchParams()
  const lang = useLang()
  const t = useText(text)
  const overview = useAsync(`map|${lang}`, (signal) => api.mapOverview({ signal }, lang))
  const reduceMotion = useReducedMotion()

  const layerParam = params.get('layer') as RiskModule | null
  const layer: RiskModule = layerParam && LAYER_IDS.includes(layerParam) ? layerParam : 'flood_risk'
  const farmId = params.get('farm')
  const nasaParam = params.get('nasa')
  const overlay: NasaLayerId | null = isNasaLayerId(nasaParam) ? nasaParam : null
  const [worldCrop, setWorldCrop] = useState<WorldCrop>('rice')

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
          <h1 className="text-xl font-bold text-ink">{t.loadFailed}</h1>
          <p className="text-ink-muted">{t.downHint}</p>
          <Button icon={<RotateCw className="size-4" />} onClick={overview.retry}>
            {t.retry}
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
            <Layers className="size-3.5" aria-hidden="true" /> {t.eyebrow}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{t.title}</h1>
        </div>
        <SegmentedControl<RiskModule>
          ariaLabel={t.layerLabel}
          options={LAYER_IDS.map((id) => ({ value: id, label: t.layers[id], icon: LAYER_ICONS[id] }))}
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
              overlay={overlay}
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
              <OrbitLoader label={t.downloading} />
            </div>
          )}

          {mapError && (
            <div className="grid h-full place-items-center p-6 text-center">
              <div className="max-w-sm space-y-2">
                <MapPinOff className="mx-auto size-8 text-ink-subtle" aria-hidden="true" />
                <p className="font-semibold text-ink">{t.noMap}</p>
                <p className="text-sm text-ink-muted">{t.noMapHint}</p>
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
            <div className="absolute bottom-3 left-3 z-10 flex flex-col items-start gap-2">
              <AnimatePresence>{overlay && <NasaLegend key="nasa-legend" id={overlay} />}</AnimatePresence>
              <div className="flex gap-2">
                <button type="button" onClick={() => setFocus({ home: true, key: Date.now() })} className={mapButton}>
                  <Maximize className="size-3.5" aria-hidden="true" /> {t.wholeCountry}
                </button>
                <button type="button" onClick={() => setFocus({ world: true, key: Date.now() })} className={mapButton}>
                  <Globe2 className="size-3.5" aria-hidden="true" /> {t.wholeWorld}
                </button>
              </div>
            </div>
          )}

          {data && !mapError && (
            <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
              <SegmentedControl
                ariaLabel={t.imagery}
                size="sm"
                value={basemap}
                onChange={setBasemap}
                className="bg-night-900/85"
                options={baseList.map((b) => ({ value: b.id, label: lang === 'bn' ? b.labelBn : b.label, icon: basemapIcons[b.id] }))}
              />
              <NasaLayerPicker value={overlay} onChange={(next) => updateParams({ nasa: next })} />
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
              ) : data && picked && !isInBangladesh(picked.lng, picked.lat) ? (
                <WorldSpotPanel point={picked} crop={worldCrop} onCropChange={setWorldCrop} onClose={() => setPicked(null)} />
              ) : data && picked ? (
                <LocationPanel
                  point={picked}
                  cell={cell}
                  inCountry
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
                <p className="text-sm text-ink-muted">{t.loading}</p>
              )}
            </motion.div>
          </AnimatePresence>
        </Card>
      </div>

      <p className="text-xs text-ink-subtle">
        {t.footer((lang === 'bn' ? baseList.find((b) => b.id === basemap)?.descriptionBn : baseList.find((b) => b.id === basemap)?.description) ?? '')}
      </p>
    </div>
  )
}
