import type { Dashboard, FarmSummary, MapOverview } from '@/types/api'

// Small map payload: a Dhaka cell, a Rajshahi (drought) cell and a Bay of Bengal cell.
export const mapOverviewFixture: MapOverview = {
  generated_at: '2026-04-10T06:00:00Z',
  data_mode: 'sample',
  cell_size_deg: 0.2,
  bbox: [88, 20.6, 92.8, 26.8],
  layers: [
    { id: 'flood_risk', title: 'Flood risk', description: 'Where heavy rain could flood fields.', sources: ['GPM', 'SMAP'], live: true },
    { id: 'water_stress', title: 'Water stress', description: 'Where soil is drying out.', sources: ['SMAP'], live: false },
    { id: 'crop_health', title: 'Crop health', description: 'Where plants look stressed.', sources: ['MODIS'], live: false },
  ],
  cells: [
    { lat: 23.8, lon: 90.4, flood_risk: 12, water_stress: 9, crop_health: 11 },
    { lat: 24.7, lon: 88.5, flood_risk: 6, water_stress: 82, crop_health: 55 },
    { lat: 20.9, lon: 90.5, flood_risk: 30, water_stress: 5, crop_health: 5 },
  ],
  farms: [
    {
      id: 'barind',
      name: 'Barind Wheat Farm',
      district: 'Rajshahi',
      crop: 'Wheat',
      lat: 24.62,
      lon: 88.56,
      overall: { score: 89, level: 'danger', summary: 'Act today: water stress is high.' },
      modules: {
        flood_risk: { score: 6, level: 'safe' },
        water_stress: { score: 81, level: 'danger' },
        crop_health: { score: 55, level: 'warning' },
      },
    },
  ],
}

export const farmsFixture: FarmSummary[] = [
  { id: 'haor', name: 'Haor Rice Field', district: 'Sunamganj', crop: 'Boro rice' },
  { id: 'barind', name: 'Barind Wheat Farm', district: 'Rajshahi', crop: 'Wheat' },
]

export function makeDashboard(farm: FarmSummary = farmsFixture[0], overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    farm: { ...farm, division: 'Test', area_acres: 2, lat: 24, lon: 90, story: `${farm.name} story.` },
    generated_at: new Date().toISOString(),
    last_satellite_pass: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    data_mode: 'sample',
    overall: { score: 83, level: 'danger', summary: 'Act today: flood risk is high.' },
    modules: [
      {
        id: 'flood_risk',
        title: 'Flood risk',
        score: 78,
        level: 'danger',
        headline: 'Flash flood likely in 2–3 days.',
        explanation: 'Heavy rain upstream.',
        metrics: [
          { label: 'Rain next 3 days', value: 254, unit: 'mm', source: 'GPM' },
          { label: 'Soil wetness', value: 91, unit: '%', source: 'SMAP' },
        ],
        trend: [22, 24, 23, 27, 30, 29, 34, 38, 45, 51, 58, 64, 71, 78],
        change_7d: 44,
        sources: ['GPM', 'SMAP'],
        data_source: 'sample',
        confidence: null,
        factors: [],
      },
      {
        id: 'water_stress',
        title: 'Water stress',
        score: 12,
        level: 'safe',
        headline: 'Plenty of water in the soil.',
        explanation: 'Recent rain filled the soil.',
        metrics: [{ label: 'Soil wetness', value: 91, unit: '%', source: 'SMAP' }],
        trend: [18, 17, 16, 15, 15, 14, 14, 13, 13, 12, 12, 12, 12, 12],
        change_7d: -2,
        sources: ['SMAP'],
        data_source: 'sample',
        confidence: null,
        factors: [],
      },
      {
        id: 'crop_health',
        title: 'Crop health',
        score: 30,
        level: 'watch',
        headline: 'Rice is ripening.',
        explanation: 'Humid air invites disease.',
        metrics: [{ label: 'Greenness change', value: -2, unit: '% this week', source: 'MODIS' }],
        trend: [22, 22, 23, 23, 24, 24, 25, 25, 26, 27, 28, 28, 29, 30],
        change_7d: 5,
        sources: ['MODIS'],
        data_source: 'sample',
        confidence: null,
        factors: [],
      },
    ],
    forecast: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${String(10 + i).padStart(2, '0')}`,
      condition: i === 2 ? ('storm' as const) : ('cloudy' as const),
      rain_mm: i === 2 ? 96 : 5,
      temp_max_c: 30,
      temp_min_c: 24,
    })),
    recommendations: [
      { id: 'r1', module: 'flood_risk', priority: 'high', title: 'Harvest ripe rice now', reason: 'Safer in store.', due: 'Today' },
      { id: 'r2', module: 'flood_risk', priority: 'medium', title: 'Clear drainage channels', reason: 'Water leaves faster.', due: 'Within 2 days' },
    ],
    ...overrides,
  }
}

// Routes fetch calls to fixtures; unknown farms return 404 like the real API.
export function mockDashboardApi(fetchSpy: { mockImplementation: (fn: (input: RequestInfo | URL) => Promise<Response>) => unknown }) {
  fetchSpy.mockImplementation(async (input) => {
    const url = String(input)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    if (url === '/api/v1/farms') return json(farmsFixture)
    const match = url.match(/^\/api\/v1\/farms\/([^/]+)\/dashboard$/)
    const farm = farmsFixture.find((f) => f.id === match?.[1])
    if (farm) return json(makeDashboard(farm, farm.id === 'barind' ? { overall: { score: 89, level: 'danger', summary: 'Act today: water stress is high.' } } : {}))
    return json({ detail: 'not found' }, 404)
  })
}
