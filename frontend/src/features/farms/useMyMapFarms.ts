import { api } from '@/lib/api'
import type { MyFarm } from '@/lib/myFarms'
import { useAsync } from '@/lib/useAsync'
import type { Dashboard, MapFarm } from '@/types/api'

const NONE: MapFarm[] = []

export function toMapFarm(d: Dashboard): MapFarm {
  return {
    id: d.farm.id,
    name: d.farm.name,
    district: d.farm.district,
    crop: d.farm.crop,
    lat: d.farm.lat,
    lon: d.farm.lon,
    overall: d.overall,
    modules: Object.fromEntries(d.modules.map((m) => [m.id, { score: m.score, level: m.level }])) as MapFarm['modules'],
  }
}

/**
 * The farmer's saved fields as map farms, with today's risk levels. A field whose data
 * isn't ready yet is simply left off the map rather than breaking it.
 */
export function useMyMapFarms(mine: MyFarm[]): MapFarm[] {
  const key = mine.length ? mine.map((f) => `${f.id}:${f.name}`).join(',') : null
  const result = useAsync(key, async (signal) => {
    const settled = await Promise.allSettled(mine.map((f) => api.dashboard(f.id, { signal }, f.name)))
    return settled.flatMap((r) => (r.status === 'fulfilled' ? [toMapFarm(r.value)] : []))
  })
  return key ? (result.data ?? NONE) : NONE
}

