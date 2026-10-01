import { ArrowRight, Crosshair, MapPin, Plus, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonStyles } from '@/components/ui/button-styles'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { digits, useLang, useText } from '@/lib/i18n'
import { riskMeta, scoreToLevel } from '@/lib/risk'
import type { GridCell, MapFarm, MapLayer, RiskModule } from '@/types/api'
import { formatLatLon, nearestPlace } from './geo'
import { placeName } from './places'
import { RiskRows } from './RiskRows'

const text = {
  en: {
    selected: 'Selected spot',
    kmFrom: (km: string, place: string) => `${km} km from ${place}`,
    clear: 'Clear selected spot',
    outside: 'No grid reading for this exact spot yet. Try a spot a little further inland.',
    addHere: 'Add a farm here',
    closeFarm: 'Close farm',
    openDashboard: 'Open farm dashboard',
  },
  bn: {
    selected: 'বেছে নেওয়া জায়গা',
    kmFrom: (km: string, place: string) => `${place} থেকে ${km} কিমি`,
    clear: 'বেছে নেওয়া জায়গা মুছুন',
    outside: 'এই জায়গার জন্য এখনও কোনো তথ্য নেই। একটু ভেতরের দিকে কোনো জায়গা চেষ্টা করুন।',
    addHere: 'এখানে জমি যোগ করুন',
    closeFarm: 'খামার বন্ধ করুন',
    openDashboard: 'খামারের ড্যাশবোর্ড খুলুন',
  },
}

function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="focus-ring shrink-0 cursor-pointer rounded-full p-1.5 text-ink-subtle transition hover:bg-surface-2 hover:text-ink"
    >
      <X className="size-4" />
    </button>
  )
}

interface LocationPanelProps {
  point: { lng: number; lat: number }
  cell: GridCell | null
  inCountry: boolean
  layers: MapLayer[]
  layer: RiskModule
  onSelectLayer: (layer: RiskModule) => void
  onClose: () => void
}

// What we know about a spot the farmer tapped.
export function LocationPanel({ point, cell, inCountry, layers, layer, onSelectLayer, onClose }: LocationPanelProps) {
  const lang = useLang()
  const t = useText(text)
  const near = nearestPlace(point.lat, point.lng)
  const nearName = placeName(near.place, lang)
  const activeScore = cell?.[layer]
  const level = activeScore !== undefined ? scoreToLevel(activeScore) : null

  return (
    <section aria-labelledby="spot-title" className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-[0.15em] text-leaf-300 uppercase">
            <Crosshair className="size-3.5" aria-hidden="true" /> {t.selected}
          </p>
          <h2 id="spot-title" className="mt-1 text-lg font-bold text-ink">
            {near.km < 5 ? nearName : t.kmFrom(digits(near.km, lang), nearName)}
          </h2>
          <p className="text-xs text-ink-subtle">{formatLatLon(point.lat, point.lng)}</p>
        </div>
        <CloseButton onClick={onClose} label={t.clear} />
      </div>

      {inCountry && cell && level ? (
        <>
          <div className="rounded-xl bg-surface-1 p-3 ring-1 ring-line">
            <RiskBadge level={level} lang={lang} />
            <p className="mt-2 text-sm text-ink">{lang === 'bn' ? riskMeta[level].messageBn : riskMeta[level].message}</p>
          </div>
          <RiskRows
            layers={layers}
            scores={{ flood_risk: cell.flood_risk, water_stress: cell.water_stress, crop_health: cell.crop_health }}
            active={layer}
            onSelectLayer={onSelectLayer}
          />
          <Link
            to={`/farms/new?lat=${point.lat.toFixed(4)}&lon=${point.lng.toFixed(4)}`}
            className="focus-ring flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-leaf-400 to-leaf-600 px-3 py-2.5 text-sm font-semibold text-night-950 shadow-glow-leaf transition hover:from-leaf-300 hover:to-leaf-500"
          >
            <Plus className="size-4" aria-hidden="true" /> {t.addHere}
          </Link>
        </>
      ) : (
        <p className="rounded-xl bg-surface-1 p-3 text-sm text-ink-muted ring-1 ring-line">
          {t.outside}
        </p>
      )}
    </section>
  )
}

interface FarmPanelProps {
  farm: MapFarm
  layers: MapLayer[]
  layer: RiskModule
  onSelectLayer: (layer: RiskModule) => void
  onClose: () => void
}

export function FarmPanel({ farm, layers, layer, onSelectLayer, onClose }: FarmPanelProps) {
  const lang = useLang()
  const t = useText(text)
  const scores = {
    flood_risk: farm.modules.flood_risk.score,
    water_stress: farm.modules.water_stress.score,
    crop_health: farm.modules.crop_health.score,
  }
  return (
    <section aria-labelledby="farm-title" className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-[0.15em] text-leaf-300 uppercase">
            <MapPin className="size-3.5" aria-hidden="true" /> {farm.district} · {farm.crop}
          </p>
          <h2 id="farm-title" className="mt-1 text-lg font-bold text-ink">
            {farm.name}
          </h2>
        </div>
        <CloseButton onClick={onClose} label={t.closeFarm} />
      </div>
      <div className="rounded-xl bg-surface-1 p-3 ring-1 ring-line">
        <RiskBadge level={farm.overall.level} lang={lang} />
        <p className="mt-2 text-sm font-semibold text-ink">{farm.overall.summary}</p>
      </div>
      <RiskRows layers={layers} scores={scores} active={layer} onSelectLayer={onSelectLayer} />
      <Link to={`/dashboard?farm=${encodeURIComponent(farm.id)}`} className={buttonStyles({ className: 'w-full' })}>
        {t.openDashboard} <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  )
}
