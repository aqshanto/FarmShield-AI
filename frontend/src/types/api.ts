// Mirrors backend/app/schemas. Keep in sync when the API changes.

export type RiskModule = 'flood_risk' | 'water_stress' | 'crop_health'

export interface HealthStatus {
  status: 'ok'
  app: string
  version: string
  environment: string
  data_mode: 'sample' | 'live'
}

export interface DataSource {
  id: string
  name: string
  full_name: string
  measures: string
  used_for: RiskModule[]
}

export interface Region {
  name: string
  lat: number
  lon: number
  zoom: number
}

export type RiskLevel = 'safe' | 'watch' | 'warning' | 'danger'
export type Priority = 'high' | 'medium' | 'low'
export type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'storm'

export interface FarmSummary {
  id: string
  name: string
  district: string
  crop: string
}

export interface Farm extends FarmSummary {
  division: string
  area_acres: number | null // unknown for farms a farmer adds
  lat: number
  lon: number
  story: string
  custom?: boolean // a farmer's own field (id "my_<lat>_<lon>_<crop>")
}

// --- adding your own farm ----------------------------------------------------------------

export interface PlaceInfo {
  name: string
  name_bn: string
  lat: number
  lon: number
  division: string
}

export interface Places {
  divisions: PlaceInfo[]
  districts: PlaceInfo[]
}

export interface CropOption {
  id: string
  name: string
  name_bn: string
  season: string
  season_bn: string
  scene: 'rice' | 'wheat' | 'potato'
}

export interface LocateResult {
  lat: number
  lon: number
  inside: boolean
  district: PlaceInfo | null
  division: PlaceInfo | null
  km_to_district_town: number | null
}

export interface Metric {
  label: string
  value: number
  unit: string
  source: string
}

export interface RiskFactor {
  id: string
  label: string
  score: number
  weight: number
  detail: string
  source: string
}

export interface RiskAction {
  kind: 'irrigate' | 'hold' | 'check' | 'none'
  title: string
  detail: string
}

export interface CropIndicators {
  crop: string
  greenness: number | null // latest clear-sky NDVI
  greenness_normal: number | null
  last_clear_view: string | null // YYYY-MM-DD
  cloud_gap_days: number | null
  heat_days: number // of 10
  heat_limit_c: number
  disease: string
  disease_days: number // of 8
}

export interface RiskModuleSummary {
  id: RiskModule
  title: string
  score: number
  level: RiskLevel
  headline: string
  explanation: string
  metrics: Metric[]
  // Last 14 daily scores, oldest first; the last value is today.
  trend: number[]
  change_7d: number
  sources: string[]
  // live: computed by a risk engine from NASA data · sample: demo scenario
  data_source: 'live' | 'sample'
  confidence: 'high' | 'medium' | 'low' | null
  factors: RiskFactor[]
  // Plain-language state ("Getting dry") and the recommended action, from live engines.
  status?: string | null
  action?: RiskAction | null
  indicators?: CropIndicators | null
}

export interface DayForecast {
  date: string // YYYY-MM-DD
  condition: WeatherCondition
  rain_mm: number
  temp_max_c: number
  temp_min_c: number
}

export interface Recommendation {
  id: string
  module: RiskModule
  priority: Priority
  title: string
  reason: string
  due: string
}

export interface GridCell {
  lat: number
  lon: number
  flood_risk: number
  water_stress: number
  crop_health: number
}

export interface MapLayer {
  id: RiskModule
  title: string
  description: string
  sources: string[]
  live: boolean
}

export interface MapFarm extends FarmSummary {
  lat: number
  lon: number
  overall: { score: number; level: RiskLevel; summary: string }
  modules: Record<RiskModule, { score: number; level: RiskLevel }>
}

/** Risk for one tapped spot anywhere on Earth (GET /map/point). */
export interface PointRisk {
  lat: number
  lon: number
  place: string | null
  country: string | null
  // false for open water: nothing to farm, so no risks.
  land: boolean
  in_bangladesh: boolean
  crop: string
  overall: { score: number; level: RiskLevel; summary: string } | null
  modules: RiskModuleSummary[]
  recommendations: Recommendation[]
  // SMAP, GPM, MODIS and VIIRS are still downloading for this spot.
  satellites_pending: boolean
}

export interface MapOverview {
  generated_at: string
  data_mode: 'sample' | 'live'
  cell_size_deg: number
  bbox: [number, number, number, number]
  layers: MapLayer[]
  cells: GridCell[]
  farms: MapFarm[]
}

export interface Dashboard {
  farm: Farm
  generated_at: string
  last_satellite_pass: string
  data_mode: 'sample' | 'live'
  overall: { score: number; level: RiskLevel; summary: string }
  modules: RiskModuleSummary[]
  forecast: DayForecast[]
  recommendations: Recommendation[]
}

export type SourceState = 'ok' | 'pending' | 'needs_token' | 'needs_approval' | 'error'

export interface SourceStatus {
  id: string
  mission: string
  provider: string
  product: string
  variables: string[]
  requires_token: boolean
  note: string
  state: SourceState
  message: string | null
  last_success: string | null
  observations: number
  rejected: number
}

export interface MissionFreshness {
  mission: string
  product: string
  latest_granule: string | null
  granule_id: string | null
  error: string | null
}

export interface LastRun {
  finished_at: string
  ok: number
  skipped: number
  error: number
  needs_token: number
  needs_approval?: number
}

export interface DataStatus {
  token_configured: boolean
  refreshing: boolean
  last_run: LastRun | null
  sources: SourceStatus[]
  missions: MissionFreshness[]
}

export type ObservedVariable =
  | 'precipitation'
  | 'soil_moisture'
  | 'soil_wetness'
  | 'root_zone_wetness'
  | 'temperature_max'
  | 'ndvi'
  | 'ndvi_normal'

export interface ObservationPoint {
  date: string // YYYY-MM-DD
  value: number
  source: string
  quality: 'good' | 'marginal'
}

export interface VariableSeries {
  id: ObservedVariable
  label: string
  unit: string
  description: string
  sources_used: string[]
  points: ObservationPoint[]
  latest: ObservationPoint | null
}

export interface FarmObservations {
  farm_id: string
  generated_at: string
  days: number
  variables: VariableSeries[]
}

// --- AI farmer assistant -------------------------------------------------------------

export type AssistantEngine = 'claude' | 'offline'

export interface AssistantStatus {
  engine: AssistantEngine
  label: string
  languages: ('en' | 'bn')[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  farm_id: string
  farm_name?: string
  lang: 'en' | 'bn'
  messages: ChatMessage[]
}

/** Server-sent events from POST /assistant/chat, in order: meta, delta*, (replace), done. */
export type ChatEvent =
  | { event: 'meta'; data: { engine: AssistantEngine; lang: 'en' | 'bn' } }
  | { event: 'delta'; data: { text: string } }
  | { event: 'replace'; data: { text: string; engine: AssistantEngine } }
  | { event: 'done'; data: { engine: AssistantEngine } }
