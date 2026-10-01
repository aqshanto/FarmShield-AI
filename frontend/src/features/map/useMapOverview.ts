import { useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import type { Lang } from '@/lib/i18n'
import { useAsync } from '@/lib/useAsync'

// Right after the server starts, it answers with the modelled map ("warming") instead of
// making visitors wait for the live one; ask again until the live map is ready.
const WARMING_RECHECK_MS = import.meta.env.MODE === 'test' ? 20 : 8000
const MAX_RECHECKS = 15 // ~2 minutes, then the modelled map simply stays

export function useMapOverview(lang: Lang) {
  const overview = useAsync(`map-overview|${lang}`, (signal) => api.mapOverview({ signal }, lang), { retries: 5 })
  const warming = overview.data?.grid_status === 'warming'
  const checks = useRef(0)
  const { status, data, retry } = overview

  useEffect(() => {
    if (status !== 'success' || data?.grid_status !== 'warming' || checks.current >= MAX_RECHECKS) return
    const timer = setTimeout(() => {
      checks.current += 1
      retry()
    }, WARMING_RECHECK_MS)
    return () => clearTimeout(timer)
  }, [status, data, retry])

  return { ...overview, warming }
}
