import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import type { DataStatus } from '@/types/api'

const POLL_MS = 2000

/**
 * Pipeline status, plus tracking of a refresh the user started. We watch for the first
 * status *after* the request that shows the run finished, so even a refresh that ends in
 * milliseconds (everything already fresh) is noticed and reported.
 */
export function useDataStatus(onFinished: (status: DataStatus) => void) {
  const [version, setVersion] = useState(0)
  const [waiting, setWaiting] = useState<{ since: number } | null>(null)
  const status = useAsync(`status-${version}`, (signal) => api.dataStatus({ signal }))
  const onFinishedRef = useRef(onFinished)

  useEffect(() => {
    onFinishedRef.current = onFinished
  })

  useEffect(() => {
    const data = status.data
    if (status.status !== 'success' || !data) return
    const finishedAfterRequest =
      waiting && !data.refreshing && data.last_run && new Date(data.last_run.finished_at).getTime() >= waiting.since
    if (finishedAfterRequest) {
      // Deferred so we never set state synchronously inside the effect.
      const timer = setTimeout(() => {
        setWaiting(null)
        onFinishedRef.current(data)
      }, 0)
      return () => clearTimeout(timer)
    }
    if (!data.refreshing && !waiting) return
    const timer = setTimeout(() => setVersion((v) => v + 1), POLL_MS)
    return () => clearTimeout(timer)
  }, [status.status, status.data, waiting, version])

  return {
    status,
    waiting: waiting !== null,
    reload: () => setVersion((v) => v + 1),
    // Call right after POST /data/refresh succeeds.
    trackRefresh: (startedAt: number) => {
      setWaiting({ since: startedAt })
      setVersion((v) => v + 1)
    },
  }
}
