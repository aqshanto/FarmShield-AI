import { env } from '@/config/env'
import type { Lang } from '@/lib/i18n'
import type {
  AssistantStatus,
  ChatEvent,
  ChatRequest,
  CropOption,
  Dashboard,
  DataSource,
  DataStatus,
  FarmObservations,
  FarmSummary,
  HealthStatus,
  LocateResult,
  MapOverview,
  PointRisk,
  Places,
  Region,
} from '@/types/api'

export class ApiError extends Error {
  readonly status: number
  // The server's plain-language reason, when it gave one (FastAPI's `detail`).
  readonly detail: string | null

  constructor(status: number, message: string, detail: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function errorDetail(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    return typeof body.detail === 'string' ? body.detail : null
  } catch {
    return null
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    throw new ApiError(response.status, `Request to ${path} failed with ${response.status}`, await errorDetail(response))
  }
  return response.json() as Promise<T>
}

// Ask for Bengali text only when needed; English URLs stay as they were.
const langQuery = (lang?: Lang, extra = '') => {
  const params = new URLSearchParams(extra)
  if (lang === 'bn') params.set('lang', 'bn')
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const api = {
  health: (init?: RequestInit) => request<HealthStatus>('/health', init),
  sources: (init?: RequestInit) => request<DataSource[]>('/sources', init),
  defaultRegion: (init?: RequestInit) => request<Region>('/region/default', init),
  farms: (init?: RequestInit, lang?: Lang) => request<FarmSummary[]>(`/farms${langQuery(lang)}`, init),
  // `name` labels a farmer's own farm (custom ids only).
  dashboard: (farmId: string, init?: RequestInit, name?: string, lang?: Lang) =>
    request<Dashboard>(`/farms/${encodeURIComponent(farmId)}/dashboard${langQuery(lang, name ? `name=${encodeURIComponent(name)}` : '')}`, init),
  mapOverview: (init?: RequestInit, lang?: Lang) => request<MapOverview>(`/map/overview${langQuery(lang)}`, init),
  mapPoint: (lat: number, lon: number, crop: string, init?: RequestInit, lang?: Lang) =>
    request<PointRisk>(`/map/point${langQuery(lang, `lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&crop=${crop}`)}`, init),
  dataStatus: (init?: RequestInit) => request<DataStatus>('/data/status', init),
  refreshData: (force = false) =>
    request<{ started: boolean; message: string }>(`/data/refresh${force ? '?force=true' : ''}`, { method: 'POST' }),
  farmObservations: (farmId: string, days = 60, init?: RequestInit) =>
    request<FarmObservations>(`/farms/${encodeURIComponent(farmId)}/observations?days=${days}`, init),
  assistantStatus: (init?: RequestInit) => request<AssistantStatus>('/assistant/status', init),
  places: (init?: RequestInit) => request<Places>('/places', init),
  crops: (init?: RequestInit) => request<CropOption[]>('/crops', init),
  locate: (lat: number, lon: number, init?: RequestInit) => request<LocateResult>(`/locate?lat=${lat}&lon=${lon}`, init),
}

function parseEvent(block: string): ChatEvent | null {
  let event = ''
  let data = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  if (!event || !data) return null
  return { event, data: JSON.parse(data) } as ChatEvent
}

/** Streams the assistant's reply as it is written (server-sent events over a POST). */
export async function* streamChat(body: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  const response = await fetch(`${env.apiBaseUrl}/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok || !response.body) {
    throw new ApiError(response.status, `Assistant request failed with ${response.status}`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    let end: number
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const event = parseEvent(buffer.slice(0, end))
      buffer = buffer.slice(end + 2)
      if (event) yield event
    }
    if (done) return
  }
}
