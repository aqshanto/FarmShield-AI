import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { DataSource, HealthStatus, Region } from '@/types/api'

export type SystemStatus =
  | { state: 'loading' }
  | { state: 'ready'; health: HealthStatus; sources: DataSource[]; region: Region }
  | { state: 'offline'; message: string }

export interface RetryPolicy {
  // Silent retries before reporting "offline" (covers the backend booting slower than the frontend).
  attempts: number
  delayMs: number
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = { attempts: 5, delayMs: 1500 }

// Checks that the backend is reachable and returns the foundation metadata.
export function useSystemStatus(policy: RetryPolicy = DEFAULT_RETRY_POLICY) {
  const [status, setStatus] = useState<SystemStatus>({ state: 'loading' })
  const [run, setRun] = useState(0)
  const { attempts, delayMs } = policy

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    let timer: ReturnType<typeof setTimeout> | undefined

    const check = (attempt: number) => {
      Promise.all([api.health({ signal }), api.sources({ signal }), api.defaultRegion({ signal })])
        .then(([health, sources, region]) => setStatus({ state: 'ready', health, sources, region }))
        .catch((error: unknown) => {
          if (signal.aborted) return
          if (attempt < attempts) {
            timer = setTimeout(() => check(attempt + 1), delayMs)
            return
          }
          const message = error instanceof Error ? error.message : 'Unknown error'
          setStatus({ state: 'offline', message })
        })
    }
    check(0)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [run, attempts, delayMs])

  const retry = useCallback(() => {
    setStatus({ state: 'loading' })
    setRun((n) => n + 1)
  }, [])

  return { status, retry }
}
