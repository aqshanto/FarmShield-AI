import { useSyncExternalStore } from 'react'

// Fields a farmer adds are kept in their own browser: no account, nothing stored on the
// server (whose disk resets on the free plan). The id carries everything the API needs.

export interface MyFarm {
  id: string // my_<lat>_<lon>_<crop>
  name: string
  cropId: string
  cropName: string
  cropNameBn: string
  lat: number
  lon: number
  district: string
  districtBn: string
  division: string
  addedAt: string
}

const KEY = 'farmshield-my-farms'
const MAX_FARMS = 20
const listeners = new Set<() => void>()
let cache: MyFarm[] | null = null

export function myFarmId(lat: number, lon: number, cropId: string) {
  return `my_${lat.toFixed(4)}_${lon.toFixed(4)}_${cropId}`
}

export const isMyFarmId = (id: string) => id.startsWith('my_')

function read(): MyFarm[] {
  if (cache) return cache
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    cache = Array.isArray(parsed) ? (parsed as MyFarm[]).filter((f) => f && typeof f.id === 'string' && isMyFarmId(f.id)) : []
  } catch {
    cache = []
  }
  return cache
}

function write(farms: MyFarm[]) {
  cache = farms
  try {
    localStorage.setItem(KEY, JSON.stringify(farms))
  } catch {
    // Storage full or blocked: the list still works for this visit.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab changed the list.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export const myFarms = {
  list: read,
  get: (id: string) => read().find((f) => f.id === id) ?? null,
  /** Adds the farm (newest first), or updates it if the same field and crop is already saved. */
  save(farm: Omit<MyFarm, 'addedAt'>) {
    const others = read().filter((f) => f.id !== farm.id)
    write([{ ...farm, addedAt: new Date().toISOString() }, ...others].slice(0, MAX_FARMS))
  },
  rename(id: string, name: string) {
    write(read().map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f)))
  },
  remove(id: string) {
    write(read().filter((f) => f.id !== id))
  },
  /** For tests. */
  reset() {
    cache = null
  },
}

export function useMyFarms(): MyFarm[] {
  return useSyncExternalStore(subscribe, read, () => [])
}
