import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mapOverviewFixture } from '@/test/fixtures'
import { MapPage } from './MapPage'

// jsdom has no WebGL, so the MapLibre canvas is replaced by a stub that exposes the
// same props and callbacks. The real canvas is verified in the browser.
vi.mock('@/features/map/MapCanvas', () => ({
  MapCanvas: (props: {
    layer: string
    basemap: string
    focus: unknown
    onPickLocation: (p: { lng: number; lat: number }) => void
    onPickFarm: (id: string) => void
    onError: (message: string) => void
  }) => (
    <div data-testid="map" data-layer={props.layer} data-basemap={props.basemap} data-focus={JSON.stringify(props.focus)}>
      <button type="button" onClick={() => props.onPickLocation({ lng: 88.56, lat: 24.62 })}>
        tap Rajshahi
      </button>
      <button type="button" onClick={() => props.onPickLocation({ lng: 90.5, lat: 20.9 })}>
        tap sea
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

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(mapOverviewFixture), { status: 200 }))
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
  })

  it('tapping outside Bangladesh explains there is no data', async () => {
    renderAt('/map')
    await userEvent.click(await screen.findByRole('button', { name: 'tap sea' }))
    expect(await screen.findByText(/outside Bangladesh/)).toBeInTheDocument()
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
