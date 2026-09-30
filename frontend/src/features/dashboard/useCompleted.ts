import { useCallback, useState } from 'react'

const storageKey = (farmId: string) => `farmshield:done:${farmId}`

function read(farmId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(farmId))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function write(farmId: string, done: Set<string>) {
  try {
    localStorage.setItem(storageKey(farmId), JSON.stringify([...done]))
  } catch {
    // Storage can be unavailable (private mode, quota); the checklist still works in memory.
  }
}

/**
 * Which recommendations the farmer has ticked off, remembered per farm on this device.
 * The caller remounts per farm (keyed by farm id), so initial state is enough.
 */
export function useCompleted(farmId: string) {
  const [done, setDone] = useState(() => read(farmId))

  const toggle = useCallback(
    (id: string) => {
      setDone((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        write(farmId, next)
        return next
      })
    },
    [farmId],
  )

  return { done, toggle }
}
