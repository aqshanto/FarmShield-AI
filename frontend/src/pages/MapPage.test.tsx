import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDashboard, mapOverviewFixture } from '@/test/fixtures'
import type { PointRisk } from '@/types/api'
import { MapPage } from './MapPage'

// jsdom has no WebGL, so the MapLibre canvas is replaced by a stub that exposes the
// same props and callbacks. The real canvas is verified in the browser.
vi.mock('@/features/map/MapCanvas', () => ({
  MapCanvas: (props: {
    layer: string
    basemap: string
    overlay: string | null
    focus: unknown
    onPickLocation: (p: { lng: number; lat: number }) => void
    onPickFarm: (id: string) => void
    onError: (message: string) => void
  }) => (
    <div data-testid="map" data-layer={props.layer} data-basemap={props.basemap} data-overlay={props.overlay ?? ''} data-focus={JSON.stringify(props.focus)}>
      <button type="button" onClick={() => props.onPickLocation({ lng: 88.56, lat: 24.62 })}>
        tap Rajshahi
      </button>
      <button type="button" onClick={() => props.onPickLocation({ lng: 90.5, lat: 20.9 })}>
        tap sea
      </button>
      <button type="button" onClick={() => props.onPickLocation({ lng: 36.82, lat: -1.29 })}>
        tap Kenya
      </button>
      <button type="button" onClick={() => props.onPickLocation({ lng: 10, lat: 80 })}>
        tap Arctic
      </button>
      <button type="button" onClick={() => props.onPickFarm('barind')}>
        tap farm
      </button>
      <button type="button" onClick={() => props.onError('no webgl')}>
        break map
      </button>
    </div>
  ),
}))

function renderAt(url: string) {
  const router = createMemoryRouter([{ path: '/map', element: <MapPage /> }, { path: '/dashboard', element: <p>dashboard</p> }], {
    initialEntries: [url],
  })
  render(<RouterProvider router={router} />)
  return router
}

const kenya: PointRisk = {
  lat: -1.3,
  lon: 36.8,
  place: 'Kiambu',
  country: 'Kenya',
  land: true,
  in_bangladesh: false,
  crop: 'Rice',
  overall: { score: 30, level: 'watch', summary: 'Mostly fine. Keep an eye on water stress.' },
  modules: makeDashboard().modules,
  recommendations: [{ id: 'r1', module: 'water_stress', priority: 'high', title: 'Check the soil in 2–3 days', reason: 'Push a finger into the soil.', due: 'This week' }],
  satellites_pending: true,
}

let pointReply: { status: number; body: unknown }
let pointUrls: string[]

beforeEach(() => {
  pointReply = { status: 200, body: kenya }
  pointUrls = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.includes('/map/point')) {
      pointUrls.push(url)
      return new Response(JSON.stringify(pointReply.body), { status: pointReply.status })
    }
    if (url.includes('gibs.earthdata.nasa.gov')) {
      return new Response('<Domains><Domain>2026-09-01/2026-09-28/P1D</Domain></Domains>', { status: 200 })
    }
    return new Response(JSON.stringify(mapOverviewFixture), { status: 200 })
  })
})

describe('MapPage', () => {
  it('loads the map with the flood layer, legend and explore panel', async () => {
    renderAt('/map')
    expect(await screen.findByTestId('map')).toHaveAttribute('data-layer', 'flood_risk')
    expect(screen.getAllByText('Where heavy rain could flood fields.').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Barind Wheat Farm/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sylhet' })).toBeInTheDocument()
  })

  it('switching layer updates the map, legend and URL', async () => {
    const router = renderAt('/map')
    await screen.findByTestId('map')
    await userEvent.click(screen.getByRole('radio', { name: /Water/ }))
    expect(screen.getByTestId('map')).toHaveAttribute('data-layer', 'water_stress')
    // Legend and side panel swap with an exit-then-enter animation, so wait for new content.
    expect((await screen.findAllByText('Where soil is drying out.')).length).toBeGreaterThan(0)
    expect(router.state.location.search).toBe('?layer=water_stress')
  })

  it('ignores an invalid layer in the URL', async () => {
    renderAt('/map?layer=volcanoes')
    expect(await screen.findByTestId('map')).toHaveAttribute('data-layer', 'flood_risk')
  })

  it('tapping a spot shows all three risks for it', async () => {
    renderAt('/map')
    await userEvent.click(await screen.findByRole('button', { name: 'tap Rajshahi' }))
    const panel = await screen.findByRole('region', { name: /Rajshahi/ })
    expect(within(panel).getByText('24.62°N, 88.56°E')).toBeInTheDocument()
    expect(within(panel).getByText('Danger · 82')).toBeInTheDocument()
    expect(within(panel).getByText('Warning · 55')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: /Add a farm here/ })).toHaveAttribute('href', '/farms/new?lat=24.6200&lon=88.5600')
  })

  it('tapping anywhere else on Earth checks that spot live', async () => {
    renderAt('/map')
    await userEvent.click(await screen.findByRole('button', { name: 'tap Kenya' }))
    const panel = await screen.findByRole('region', { name: 'Kiambu, Kenya' })
    expect(await within(panel).findByText('Mostly fine. Keep an eye on water stress.')).toBeInTheDocument()
    expect(within(panel).getByText('Danger · 78')).toBeInTheDocument()
    expect(within(panel).getByText('Check the soil in 2–3 days')).toBeInTheDocument()
    expect(within(panel).getByText(/downloading now/)).toBeInTheDocument()
    expect(pointUrls[0]).toBe('/api/v1/map/point?lat=-1.2900&lon=36.8200&crop=rice')
    expect(screen.queryByRole('link', { name: /Add a farm here/ })).not.toBeInTheDocument()

    // Changing the crop asks again for that crop.
    await userEvent.click(within(panel).getByRole('radio', { name: 'Wheat' }))
    await within(panel).findByText('Mostly fine. Keep an eye on water stress.')
    expect(pointUrls.at(-1)).toContain('crop=wheat')
  })

  it('open water and demo servers get a plain explanation', async () => {
    pointReply = { status: 200, body: { ...kenya, place: null, country: null, land: false, overall: null, modules: [], recommendations: [] } }
    renderAt('/map')
    await userEvent.click(await screen.findByRole('button', { name: 'tap sea' }))
    expect((await screen.findAllByText('This spot is open water.')).length).toBeGreaterThan(0)

    pointReply = { status: 409, body: { detail: 'demo' } }
    await userEvent.click(screen.getByRole('button', { name: 'tap Kenya' }))
    expect(await screen.findByText(/running the demo scenario/)).toBeInTheDocument()
  })

  it('names a spot by its coordinates when no place name came back', async () => {
    pointReply = { status: 200, body: { ...kenya, place: null, country: null } }
    renderAt('/map')
    await userEvent.click(await screen.findByRole('button', { name: 'tap Kenya' }))
    const panel = await screen.findByRole('region', { name: 'Selected spot' })
    expect(within(panel).getByText('1.29°S, 36.82°E')).toBeInTheDocument()
  })

  it('does not ask about polar spots', async () => {
    renderAt('/map')
    await userEvent.click(await screen.findByRole('button', { name: 'tap Arctic' }))
    expect(await screen.findByText(/no farmland this close to the poles/)).toBeInTheDocument()
    expect(pointUrls).toEqual([])
  })

  it('NASA world layers switch on with a legend and the picture date, and are linkable', async () => {
    const router = renderAt('/map')
    await screen.findByTestId('map')
    await userEvent.click(screen.getByRole('radio', { name: /Soil moisture/ }))
    expect(screen.getByTestId('map')).toHaveAttribute('data-overlay', 'soil')
    expect(router.state.location.search).toBe('?nasa=soil')
    const legend = await screen.findByRole('group', { name: 'Soil moisture' })
    expect(within(legend).getByText('Dry')).toBeInTheDocument()
    expect(await within(legend).findByText('NASA picture of September 28')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /Off/ }))
    expect(screen.getByTestId('map')).toHaveAttribute('data-overlay', '')
    expect(router.state.location.search).toBe('')
  })

  it('zooms out to the whole world', async () => {
    renderAt('/map?nasa=rain')
    expect(await screen.findByTestId('map')).toHaveAttribute('data-overlay', 'rain')
    await userEvent.click(screen.getByRole('button', { name: /Whole world/ }))
    expect(JSON.parse(screen.getByTestId('map').dataset.focus!)).toMatchObject({ world: true })
  })

  it('tapping a farm opens its panel, flies to it and links to its dashboard', async () => {
    const router = renderAt('/map')
    await userEvent.click(await screen.findByRole('button', { name: 'tap farm' }))
    expect(await screen.findByRole('heading', { name: 'Barind Wheat Farm' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?farm=barind')
    expect(JSON.parse(screen.getByTestId('map').dataset.focus!)).toMatchObject({ center: [88.56, 24.62], zoom: 8 })

    await userEvent.click(screen.getByRole('link', { name: /Open farm dashboard/ }))
    expect(router.state.location.pathname).toBe('/dashboard')
    expect(router.state.location.search).toBe('?farm=barind')
  })

  it('opening /map?farm= goes straight to that farm', async () => {
    renderAt('/map?farm=barind&layer=water_stress')
    expect(await screen.findByRole('heading', { name: 'Barind Wheat Farm' })).toBeInTheDocument()
    expect(screen.getByTestId('map')).toHaveAttribute('data-layer', 'water_stress')
    expect(JSON.parse(screen.getByTestId('map').dataset.focus!)).toMatchObject({ center: [88.56, 24.62] })
  })

  it('division shortcuts pick that place', async () => {
    renderAt('/map')
    await userEvent.click(await screen.findByRole('button', { name: 'Rajshahi' }))
    expect(await screen.findByRole('region', { name: 'Rajshahi' })).toBeInTheDocument()
  })

  it('switches background imagery', async () => {
    renderAt('/map')
    await screen.findByTestId('map')
    await userEvent.click(screen.getByRole('radio', { name: /Night/ }))
    expect(screen.getByTestId('map')).toHaveAttribute('data-basemap', 'night')
  })

  it('falls back gracefully when the device cannot draw the map', async () => {
    renderAt('/map')
    await userEvent.click(await screen.findByRole('button', { name: 'break map' }))
    expect(screen.getByText('This device can’t show the interactive map')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Barind Wheat Farm/ })).toBeInTheDocument()
  })

  it('offers retry when the map data fails to load', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    renderAt('/map')
    expect(await screen.findByRole('heading', { name: 'We couldn’t load the map data' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
