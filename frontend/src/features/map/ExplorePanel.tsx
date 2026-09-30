import { Hand, Home, Navigation } from 'lucide-react'
import { riskMeta } from '@/lib/risk'
import type { MapFarm, RiskModule } from '@/types/api'
import { DIVISIONS, type Place } from './places'

interface ExplorePanelProps {
  farms: MapFarm[]
  layer: RiskModule
  onPickFarm: (farmId: string) => void
  onJump: (place: Place) => void
}

// Starting point, and the keyboard/screen-reader friendly way to explore the map.
export function ExplorePanel({ farms, layer, onPickFarm, onJump }: ExplorePanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl bg-leaf-500/10 p-3 ring-1 ring-leaf-400/25">
        <Hand className="mt-0.5 size-5 shrink-0 text-leaf-300" aria-hidden="true" />
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">Tap anywhere on the map</span> to see flood, water and crop risk for that
          spot.
        </p>
      </div>

      <section aria-labelledby="farms-title">
        <h2 id="farms-title" className="mb-2 text-sm font-bold text-ink">
          Your farms
        </h2>
        <ul className="space-y-2">
          {farms.map((farm) => {
            const { level } = farm.modules[layer]
            return (
              <li key={farm.id}>
                <button
                  type="button"
                  onClick={() => onPickFarm(farm.id)}
                  className="focus-ring flex w-full cursor-pointer items-center gap-3 rounded-xl bg-surface-1 p-3 text-left ring-1 ring-line transition hover:bg-surface-2 active:scale-[0.98]"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-night-800 ring-2" style={{ ['--tw-ring-color' as string]: riskMeta[level].color }}>
                    <Home className="size-4 text-ink" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{farm.name}</span>
                    <span className="block text-xs text-ink-subtle">
                      {farm.district} · {riskMeta[level].label}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="jump-title">
        <h2 id="jump-title" className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
          <Navigation className="size-4 text-ink-subtle" aria-hidden="true" /> Jump to a division
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {DIVISIONS.map((place) => (
            <button
              key={place.name}
              type="button"
              onClick={() => onJump(place)}
              className="focus-ring cursor-pointer rounded-full bg-surface-1 px-3 py-1.5 text-xs font-semibold text-ink-muted ring-1 ring-line transition hover:bg-surface-2 hover:text-ink active:scale-95"
            >
              {place.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
