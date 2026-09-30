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
  area_acres: number
  lat: number
  lon: number
  story: string
}

export interface Metric {
  label: string
  value: number
  unit: string
  source: string
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
}

export interface MapFarm extends FarmSummary {
  lat: number
  lon: number
  overall: { score: number; level: RiskLevel; summary: string }
  modules: Record<RiskModule, { score: number; level: RiskLevel }>
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
