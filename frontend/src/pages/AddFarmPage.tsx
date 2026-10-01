import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Bean, Carrot, Check, Cherry, CloudOff, Flower2, Leaf, LocateFixed, MapPin, RotateCw, Sprout, Wheat } from 'lucide-react'
import { lazy, Suspense, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/toast/useToast'
import type { PickedPoint, PickerFocus } from '@/features/add-farm/LocationPickerMap'
import { addFarmText } from '@/features/add-farm/strings'
import { FieldScene } from '@/features/field/FieldScene'
import { previewState } from '@/features/field/fieldState'
import { isInBangladesh } from '@/features/map/geo'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { type Lang, saveLang, savedLang } from '@/lib/i18n'
import { fadeUp, spring, stagger } from '@/lib/motion'
import { myFarmId, myFarms } from '@/lib/myFarms'
import { useAsync } from '@/lib/useAsync'
import type { CropOption, PlaceInfo } from '@/types/api'

// The map engine is heavy; load it with the page's first paint out of the way.
const LocationPickerMap = lazy(async () => ({ default: (await import('@/features/add-farm/LocationPickerMap')).LocationPickerMap }))

const CROP_ICONS: Record<string, typeof Sprout> = {
  'boro-rice': Sprout,
  'aman-rice': Sprout,
  'aus-rice': Sprout,
  wheat: Wheat,
  maize: Wheat,
  potato: Carrot,
  jute: Leaf,
  mustard: Flower2,
  lentil: Bean,
  tomato: Cherry,
}

type GpsState = 'idle' | 'locating' | 'denied' | 'unavailable' | 'outside'

function pointFromParams(params: URLSearchParams): PickedPoint | null {
  const lat = Number(params.get('lat'))
  const lon = Number(params.get('lon'))
  return params.has('lat') && params.has('lon') && Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
}

function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Steps">
      {labels.map((label, i) => (
        <li key={label} className="flex items-center gap-2" aria-current={i === step ? 'step' : undefined}>
          <motion.span
            initial={false}
            animate={{ scale: i === step ? 1.1 : 1 }}
            transition={spring.bouncy}
            className={cn(
              'grid size-8 place-items-center rounded-full text-sm font-bold ring-1 transition-colors',
              i < step ? 'bg-leaf-500 text-night-950 ring-leaf-400' : i === step ? 'bg-leaf-500/20 text-leaf-200 ring-leaf-400' : 'bg-surface-2 text-ink-subtle ring-line',
            )}
          >
            {i < step ? <Check className="size-4" aria-hidden="true" /> : i + 1}
          </motion.span>
          <span className={cn('text-sm font-semibold', i === step ? 'text-ink' : 'text-ink-subtle')}>{label}</span>
          {i < labels.length - 1 && <span className="mx-1 h-px w-6 bg-line sm:w-10" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  )
}

export function AddFarmPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [lang, setLang] = useState<Lang>(savedLang)
  const t = addFarmText[lang]

  const places = useAsync('places', (signal) => api.places({ signal }), { retries: 3 })
  const crops = useAsync('crops', (signal) => api.crops({ signal }), { retries: 3 })

  const [initial] = useState(() => pointFromParams(params))
  const [point, setPoint] = useState<PickedPoint | null>(initial)
  const [focus, setFocus] = useState<PickerFocus | null>(initial ? { ...initial, zoom: 9, key: 0 } : null)
  const pointKey = point ? `${point.lat.toFixed(4)},${point.lon.toFixed(4)}` : null
  const located = useAsync(pointKey && point && isInBangladesh(point.lon, point.lat) ? pointKey : null, (signal) =>
    api.locate(point!.lat, point!.lon, { signal }),
  )
  const locatedHere = located.data && pointKey === `${located.data.lat.toFixed(4)},${located.data.lon.toFixed(4)}` ? located.data : null

  const focusCount = useRef(0) // each fly-to request gets a new key
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [division, setDivision] = useState<string | null>(null)
  const [pickedDistrict, setPickedDistrict] = useState<string | null>(null)
  const [gps, setGps] = useState<GpsState>('idle')
  const [cropId, setCropId] = useState<string | null>(null)
  const [name, setName] = useState('')

  const crop = crops.data?.find((c) => c.id === cropId) ?? null
  const cropLabel = (c: CropOption) => (lang === 'bn' ? c.name_bn : c.name)
  const placeLabel = (p: PlaceInfo) => (lang === 'bn' ? p.name_bn : p.name)
  const outside = point !== null && !isInBangladesh(point.lon, point.lat)
  const locationReady = Boolean(locatedHere?.inside)

  const changeLang = (next: Lang) => {
    setLang(next)
    saveLang(next)
  }
  const go = (next: number) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }
  const pick = (p: PickedPoint, zoom?: number) => {
    setPoint(p)
    setPickedDistrict(null)
    if (zoom) setFocus({ ...p, zoom, key: ++focusCount.current })
  }
  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return setGps('unavailable')
    setGps('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        if (!isInBangladesh(p.lon, p.lat)) return setGps('outside')
        setGps('idle')
        pick(p, 12)
      },
      (error) => setGps(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }
  const chooseDistrict = (d: PlaceInfo) => {
    pick({ lat: d.lat, lon: d.lon }, 10)
    setPickedDistrict(d.name)
  }
  const save = () => {
    if (!point || !crop || !locatedHere?.district || !locatedHere.division) return
    const id = myFarmId(point.lat, point.lon, crop.id)
    const finalName = name.trim() || t.defaultName(cropLabel(crop))
    myFarms.save({
      id,
      name: finalName,
      cropId: crop.id,
      cropName: crop.name,
      cropNameBn: crop.name_bn,
      lat: Number(point.lat.toFixed(4)),
      lon: Number(point.lon.toFixed(4)),
      district: locatedHere.district.name,
      districtBn: locatedHere.district.name_bn,
      division: locatedHere.division.name,
    })
    toast({ title: t.saved(finalName), description: t.savedHint, tone: 'success' })
    navigate(`/dashboard?farm=${encodeURIComponent(id)}`)
  }

  if ((places.status === 'error' && !places.data) || (crops.status === 'error' && !crops.data)) {
    return (
      <div className="grid place-items-center py-20" lang={lang}>
        <Card className="max-w-md space-y-4 p-8 text-center">
          <CloudOff className="mx-auto size-10 text-ink-subtle" aria-hidden="true" />
          <p className="text-ink-muted">{t.loadError}</p>
          <Button icon={<RotateCw className="size-4" />} onClick={() => (places.retry(), crops.retry())}>
            {t.retry}
          </Button>
        </Card>
      </div>
    )
  }

  const where = locatedHere?.district && locatedHere.division && (
    <>
      <span className="font-semibold text-ink">{t.near(placeLabel(locatedHere.district), placeLabel(locatedHere.division))}</span>
      <span className="text-ink-subtle"> · {t.kmFrom(locatedHere.km_to_district_town ?? 0, placeLabel(locatedHere.district))}</span>
    </>
  )

  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="mx-auto max-w-5xl space-y-6 py-6" lang={lang}>
      <motion.header variants={fadeUp} className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{t.title}</h1>
          <p className="max-w-xl text-ink-muted">{t.subtitle}</p>
        </div>
        <SegmentedControl<Lang>
          ariaLabel="Language / ভাষা"
          size="sm"
          value={lang}
          onChange={changeLang}
          options={[
            { value: 'en', label: 'English' },
            { value: 'bn', label: 'বাংলা', lang: 'bn' },
          ]}
        />
      </motion.header>

      <motion.div variants={fadeUp}>
        <Stepper step={step} labels={t.steps} />
      </motion.div>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.section
          key={step}
          custom={direction}
          initial={{ opacity: 0, x: direction * 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -40 }}
          transition={spring.gentle}
          aria-labelledby="add-farm-step"
          className="space-y-5"
        >
          {step === 0 && (
            <>
              <div>
                <h2 id="add-farm-step" className="text-xl font-bold text-ink">
                  {t.whereTitle}
                </h2>
                <p className="text-sm text-ink-muted">{t.whereHint}</p>
              </div>
              <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
                <div className="space-y-4">
                  <Button icon={gps === 'locating' ? <Spinner className="size-4" /> : <LocateFixed className="size-4" />} onClick={useMyLocation} disabled={gps === 'locating'}>
                    {gps === 'locating' ? t.locating : t.useLocation}
                  </Button>
                  {(gps === 'denied' || gps === 'unavailable' || gps === 'outside') && (
                    <p role="alert" className="rounded-xl bg-harvest-400/10 p-3 text-sm text-harvest-200 ring-1 ring-harvest-300/30">
                      {gps === 'denied' ? t.denied : gps === 'outside' ? t.gpsOutside : t.unavailable}
                    </p>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-ink">{t.chooseDivision}</p>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.chooseDivision}>
                      {places.data?.divisions.map((d) => (
                        <button
                          key={d.name}
                          type="button"
                          aria-pressed={division === d.name}
                          onClick={() => {
                            setDivision(d.name)
                            setFocus({ lat: d.lat, lon: d.lon, zoom: 8, key: ++focusCount.current })
                          }}
                          className={cn(
                            'focus-ring cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition',
                            division === d.name ? 'bg-leaf-500/20 text-leaf-200 ring-leaf-400' : 'bg-surface-2 text-ink-muted ring-line hover:text-ink',
                          )}
                        >
                          {placeLabel(d)}
                        </button>
                      ))}
                    </div>
                    <AnimatePresence>
                      {division && (
                        <motion.div
                          key={division}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-1.5 pt-2 sm:grid-cols-3" role="group" aria-label={division}>
                            {places.data?.districts
                              .filter((d) => d.division === division)
                              .map((d) => (
                                <button
                                  key={d.name}
                                  type="button"
                                  aria-pressed={pickedDistrict === d.name}
                                  onClick={() => chooseDistrict(d)}
                                  className={cn(
                                    'focus-ring cursor-pointer rounded-xl px-2.5 py-2 text-left text-sm ring-1 transition',
                                    pickedDistrict === d.name ? 'bg-leaf-500 font-semibold text-night-950 ring-leaf-300' : 'bg-surface-1 text-ink ring-line hover:bg-surface-2',
                                  )}
                                >
                                  {placeLabel(d)}
                                </button>
                              ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {pickedDistrict && <p className="text-xs text-leaf-200">{t.districtHint}</p>}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="glass relative h-[52vh] min-h-80 overflow-hidden rounded-3xl lg:h-[440px]">
                    <Suspense fallback={<div className="grid h-full place-items-center"><Spinner /></div>}>
                      <LocationPickerMap value={point} focus={focus} onPick={(p) => pick(p)} label={t.mapLabel} viewLabels={{ map: t.viewMap, satellite: t.viewSatellite }} />
                    </Suspense>
                    {!point && (
                      <p className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-night-950/75 px-3 py-1.5 text-sm font-semibold text-ink backdrop-blur">
                        <MapPin className="mr-1 inline size-4 align-[-3px] text-leaf-300" aria-hidden="true" />
                        {t.tapMap}
                      </p>
                    )}
                  </div>
                  <div aria-live="polite" className="min-h-12 rounded-2xl bg-surface-1 px-4 py-3 text-sm ring-1 ring-line">
                    {!point ? (
                      <span className="text-ink-subtle">{t.tapMap}</span>
                    ) : outside ? (
                      <span className="text-harvest-200">{t.outside}</span>
                    ) : where ? (
                      <span className="flex items-start gap-2">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-leaf-300" aria-hidden="true" />
                        <span>{where}</span>
                      </span>
                    ) : (
                      <span className="text-ink-subtle">{t.checking}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button iconRight={<ArrowRight className="size-4" />} disabled={!locationReady} onClick={() => go(1)}>
                  {t.next}
                </Button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h2 id="add-farm-step" className="text-xl font-bold text-ink">
                  {t.cropTitle}
                </h2>
                <p className="text-sm text-ink-muted">{t.cropHint}</p>
              </div>
              <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
                <motion.div variants={stagger(0.04)} initial="hidden" animate="show" role="radiogroup" aria-label={t.cropTitle} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {crops.data?.map((c) => {
                    const Icon = CROP_ICONS[c.id] ?? Sprout
                    const selected = c.id === cropId
                    return (
                      <motion.button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        variants={fadeUp}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setCropId(c.id)}
                        className={cn(
                          'focus-ring flex cursor-pointer flex-col items-start gap-1.5 rounded-2xl p-3 text-left ring-1 transition-colors',
                          selected ? 'bg-leaf-500/15 ring-2 ring-leaf-400' : 'bg-surface-1 ring-line hover:bg-surface-2',
                        )}
                      >
                        <span className={cn('grid size-9 place-items-center rounded-xl', selected ? 'bg-leaf-400 text-night-950' : 'bg-surface-2 text-leaf-300')}>
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <span className="font-semibold text-ink">{cropLabel(c)}</span>
                        <span className="text-xs text-ink-subtle">{lang === 'bn' ? c.name : c.name_bn}</span>
                        <span className="text-xs text-ink-muted">{lang === 'bn' ? c.season_bn : c.season}</span>
                      </motion.button>
                    )
                  })}
                </motion.div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-ink">{t.preview}</p>
                  <div className="overflow-hidden rounded-2xl ring-1 ring-line">
                    <FieldScene state={previewState(crop?.scene ?? 'rice', 'crop_health', 0)} label={crop ? cropLabel(crop) : t.preview} />
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => go(0)}>
                  {t.back}
                </Button>
                <Button iconRight={<ArrowRight className="size-4" />} disabled={!crop} onClick={() => go(2)}>
                  {t.next}
                </Button>
              </div>
            </>
          )}

          {step === 2 && crop && (
            <>
              <div>
                <h2 id="add-farm-step" className="text-xl font-bold text-ink">
                  {t.nameTitle}
                </h2>
                <p className="text-sm text-ink-muted">{t.nameHint}</p>
              </div>
              <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
                <div className="space-y-4">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-ink">{t.nameLabel}</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={40}
                      placeholder={t.defaultName(cropLabel(crop))}
                      className="focus-ring w-full rounded-xl bg-surface-1 px-4 py-3 text-ink ring-1 ring-line placeholder:text-ink-subtle"
                    />
                  </label>
                  <Card className="space-y-2 p-4">
                    <p className="text-xs font-bold tracking-widest text-leaf-300 uppercase">{t.summary}</p>
                    <p className="text-lg font-bold text-ink">{name.trim() || t.defaultName(cropLabel(crop))}</p>
                    <p className="text-sm text-ink-muted">{where}</p>
                    <p className="text-sm text-ink-muted">
                      {cropLabel(crop)} · {lang === 'bn' ? crop.season_bn : crop.season}
                    </p>
                  </Card>
                  <p className="text-xs text-ink-subtle">{t.privacy}</p>
                </div>
                <div className="overflow-hidden rounded-2xl ring-1 ring-line">
                  <FieldScene state={previewState(crop.scene, 'crop_health', 0)} label={cropLabel(crop)} />
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => go(1)}>
                  {t.back}
                </Button>
                <Button size="lg" icon={<Check className="size-5" />} onClick={save}>
                  {t.save}
                </Button>
              </div>
            </>
          )}
        </motion.section>
      </AnimatePresence>
    </motion.div>
  )
}
