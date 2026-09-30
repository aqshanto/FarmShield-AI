import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast/ToastProvider'
import { farmsFixture } from '@/test/fixtures'
import type { DataStatus, FarmObservations, SourceStatus } from '@/types/api'
import { DataPage } from './DataPage'

const src = (id: string, mission: string, state: SourceStatus['state'], observations = 0, rejected = 0): SourceStatus => ({
  id,
  mission,
  provider: 'p',
  product: `${mission} product`,
  variables: [],
  requires_token: state === 'needs_token',
  note: '',
  state,
  message: state === 'needs_token' ? 'Set EARTHDATA_TOKEN' : null,
  last_success: null,
  observations,
  rejected,
})

function statusFixture(lastRunAt: string, overrides: Partial<DataStatus> = {}): DataStatus {
  return {
    token_configured: false,
    refreshing: false,
    last_run: { finished_at: lastRunAt, ok: 0, skipped: 9, error: 0, needs_token: 6 },
    sources: [
      src('nasa_power', 'POWER', 'ok', 696),
      src('modis', 'MODIS', 'ok', 10, 22),
      src('viirs', 'VIIRS', 'ok', 48),
      src('gpm_imerg', 'GPM', 'needs_token'),
      src('smap', 'SMAP', 'needs_token'),
    ],
    missions: ['SMAP', 'GPM', 'MODIS', 'VIIRS'].map((mission) => ({
      mission,
      product: mission,
      latest_granule: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      granule_id: 'g',
      error: null,
    })),
    ...overrides,
  }
}

const today = new Date().toISOString().slice(0, 10)
const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function observations(farmId: string): FarmObservations {
  const series = (id: string, label: string, points: [number, number][], source = 'nasa_power') => ({
    id,
    label,
    unit: '',
    description: '',
    sources_used: points.length ? [source] : [],
    points: points.map(([offset, value]) => ({ date: day(offset), value, source, quality: 'good' as const })),
    latest: points.length ? { date: day(points[points.length - 1][0]), value: points[points.length - 1][1], source, quality: 'good' as const } : null,
  })
  return {
    farm_id: farmId,
    generated_at: `${today}T06:00:00Z`,
    days: 60,
    variables: [
      series('precipitation', 'Rainfall', [[10, 20], [5, 8], [4, 3]]),
      series('soil_moisture', 'Soil moisture', []),
      series('soil_wetness', 'Soil wetness', [[5, 0.7], [4, 0.73]]),
      series('root_zone_wetness', 'Root-zone wetness', [[5, 0.74], [4, 0.74]]),
      series('temperature_max', 'Max temperature', [[5, 31], [4, 33]]),
      series('ndvi', 'Plant greenness (NDVI)', [[100, 0.7]], 'modis'),
      series('ndvi_normal', 'Normal greenness', [[100, 0.6], [4, 0.9]], 'viirs'),
    ],
  } as FarmObservations
}

let statusResponses: DataStatus[]
let refreshCalls = 0

beforeEach(() => {
  refreshCalls = 0
  statusResponses = [statusFixture(new Date(Date.now() - 60_000).toISOString())]
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    if (url === '/api/v1/data/status') return json(statusResponses.length > 1 ? statusResponses.shift() : statusResponses[0])
    if (url === '/api/v1/data/refresh' && init?.method === 'POST') {
      refreshCalls++
      // The run finishes instantly (everything fresh): the next status already shows it done.
      statusResponses = [statusFixture(new Date().toISOString())]
      return json({ started: true, message: 'ok' }, 202)
    }
    if (url === '/api/v1/farms') return json(farmsFixture)
    const match = url.match(/^\/api\/v1\/farms\/([^/]+)\/observations/)
    if (match) return json(observations(match[1]))
    return json({ detail: 'not found' }, 404)
  })
})

function renderAt(url: string) {
  const router = createMemoryRouter([{ path: '/data', element: <DataPage /> }], { initialEntries: [url] })
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

describe('DataPage', () => {
  it('shows the pipeline and each mission’s state', async () => {
    renderAt('/data')
    const pipeline = await screen.findByRole('list', { name: 'How NASA data reaches your farm' })
    expect(within(pipeline).getByText('cloudy views removed')).toBeInTheDocument()

    const smap = screen.getByRole('heading', { name: 'SMAP' }).closest('.glass') as HTMLElement
    expect(within(smap).getByText('Using stand-in')).toBeInTheDocument()
    expect(within(smap).getByText(/696 via NASA POWER/)).toBeInTheDocument()
    const modis = screen.getByRole('heading', { name: 'MODIS' }).closest('.glass') as HTMLElement
    expect(within(modis).getByText('Live')).toBeInTheDocument()
    expect(within(modis).getByText('22')).toBeInTheDocument()
    const viirs = screen.getByRole('heading', { name: 'VIIRS' }).closest('.glass') as HTMLElement
    expect(within(viirs).getByText('Baseline')).toBeInTheDocument()
  })

  it('explains how to unlock GPM and SMAP when no token is set', async () => {
    renderAt('/data')
    expect(await screen.findByRole('heading', { name: 'Unlock GPM and SMAP measurements' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /urs\.earthdata\.nasa\.gov/ })).toHaveAttribute('href', 'https://urs.earthdata.nasa.gov/')
  })

  it('hides the token callout once a token is configured', async () => {
    statusResponses = [statusFixture(new Date().toISOString(), { token_configured: true })]
    renderAt('/data')
    await screen.findByRole('heading', { name: 'SMAP' })
    expect(screen.queryByRole('heading', { name: 'Unlock GPM and SMAP measurements' })).not.toBeInTheDocument()
  })

  it('shows the farm’s observations in plain words and charts', async () => {
    renderAt('/data')
    expect(await screen.findByText('11 mm')).toBeInTheDocument() // rain in the last 7 days: 8 + 3
    // 73% also appears as the chart's direct end label, so check the stat tile itself.
    const soilTile = screen.getByText('Surface soil', { selector: 'p' }).parentElement!
    expect(within(soilTile).getByText('73%')).toBeInTheDocument()
    expect(screen.getByText('Lush and green')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Daily rainfall, last 60 days' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Plant greenness/ })).toBeInTheDocument()
    // Exact day counting is unit-tested in insights.test.ts; here the fixture mixes UTC and
    // local dates, so the count can differ by one depending on the time of day.
    expect(screen.getByText(/Clouds have hidden this field for \d+ days/)).toBeInTheDocument()
  })

  it('switching farm loads that farm and keeps it in the URL', async () => {
    const router = renderAt('/data')
    await screen.findByText('11 mm')
    await userEvent.click(screen.getByRole('radio', { name: 'Rajshahi' }))
    expect(router.state.location.search).toBe('?farm=barind')
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/v1/farms/barind/observations?days=60', expect.anything()))
  })

  it('refresh reports back even when everything was already up to date', async () => {
    renderAt('/data')
    await userEvent.click(await screen.findByRole('button', { name: /Refresh from NASA/ }))
    expect(refreshCalls).toBe(1)
    expect(await screen.findByText('Already up to date')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Refresh from NASA/ })).toBeEnabled()
  })
})
