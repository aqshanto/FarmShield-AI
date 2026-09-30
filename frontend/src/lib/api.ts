import { env } from '@/config/env'
import type {
  Dashboard,
  DataSource,
  DataStatus,
  FarmObservations,
  FarmSummary,
  HealthStatus,
  MapOverview,
  Region,
} from '@/types/api'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    throw new ApiError(response.status, `Request to ${path} failed with ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  health: (init?: RequestInit) => request<HealthStatus>('/health', init),
  sources: (init?: RequestInit) => request<DataSource[]>('/sources', init),
  defaultRegion: (init?: RequestInit) => request<Region>('/region/default', init),
  farms: (init?: RequestInit) => request<FarmSummary[]>('/farms', init),
  dashboard: (farmId: string, init?: RequestInit) =>
    request<Dashboard>(`/farms/${encodeURIComponent(farmId)}/dashboard`, init),
  mapOverview: (init?: RequestInit) => request<MapOverview>('/map/overview', init),
  dataStatus: (init?: RequestInit) => request<DataStatus>('/data/status', init),
  refreshData: (force = false) =>
    request<{ started: boolean; message: string }>(`/data/refresh${force ? '?force=true' : ''}`, { method: 'POST' }),
  farmObservations: (farmId: string, days = 60, init?: RequestInit) =>
    request<FarmObservations>(`/farms/${encodeURIComponent(farmId)}/observations?days=${days}`, init),
}
