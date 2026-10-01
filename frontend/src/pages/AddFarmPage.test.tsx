import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MotionGlobalConfig } from 'framer-motion'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast/ToastProvider'
import { myFarms } from '@/lib/myFarms'
import type { CropOption, Places } from '@/types/api'
import { AddFarmPage } from './AddFarmPage'

// No WebGL in tests: the map becomes buttons that "tap" a point.
vi.mock('@/features/add-farm/LocationPickerMap', () => ({
  LocationPickerMap: ({ value, onPick }: { value: { lat: number; lon: number } | null; onPick: (p: { lat: number; lon: number }) => void }) => (
    <div>
      <p data-testid="pin">{value ? `${value.lat},${value.lon}` : 'none'}</p>
      <button type="button" onClick={() => onPick({ lat: 25.571, lon: 88.7649 })}>
        tap Dinajpur field
      </button>
      <button type="button" onClick={() => onPick({ lat: 22.5, lon: 88.3 })}>
        tap Kolkata
      </button>
    </div>
  ),
}))

const places: Places = {
  divisions: [{ name: 'Rangpur', name_bn: 'রংপুর', lat: 25.74, lon: 89.25, division: '' }],
  districts: [
    { name: 'Rangpur', name_bn: 'রংপুর', lat: 25.74, lon: 89.25, division: 'Rangpur' },
    { name: 'Dinajpur', name_bn: 'দিনাজপুর', lat: 25.63, lon: 88.64, division: 'Rangpur' },
  ],
}
const crops: CropOption[] = [
  { id: 'aman-rice', name: 'Aman rice', name_bn: 'আমন ধান', season: 'Monsoon (Jul–Nov)', season_bn: 'বর্ষা', scene: 'rice' },
  { id: 'maize', name: 'Maize', name_bn: 'ভুট্টা', season: 'Winter or summer', season_bn: 'শীত বা গ্রীষ্ম', scene: 'wheat' },
]

function mockApi() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://x')
    const json = (body: unknown) => new Response(JSON.stringify(body))
    if (url.pathname === '/api/v1/places') return json(places)
    if (url.pathname === '/api/v1/crops') return json(crops)
    if (url.pathname === '/api/v1/locate') {
      const lat = Number(url.searchParams.get('lat'))
      const lon = Number(url.searchParams.get('lon'))
      return json({ lat, lon, inside: true, district: places.districts[1], division: places.divisions[0], km_to_district_town: lat === 25.63 ? 0 : 14 })
    }
    return new Response('{}', { status: 404 })
  })
}

function renderPage(url = '/farms/new') {
  const router = createMemoryRouter(
    [
      { path: '/farms/new', element: <AddFarmPage /> },
      { path: '/dashboard', element: <p>dashboard page</p> },
    ],
    { initialEntries: [url] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

beforeEach(() => {
  localStorage.clear()
  myFarms.reset()
  mockApi()
  // Steps swap with exit animations; finish them instantly in tests.
  MotionGlobalConfig.skipAnimations = true
})
afterEach(() => {
  MotionGlobalConfig.skipAnimations = false
  delete (navigator as { geolocation?: unknown }).geolocation
})

describe('AddFarmPage', () => {
  it('adds a field in three steps and opens its dashboard', async () => {
    const router = renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Add my farm' })).toBeInTheDocument()
    const next = () => screen.getByRole('button', { name: 'Next' })
    expect(next()).toBeDisabled()

    // 1. Where: choose division and district, then fine-tune on the map.
    await userEvent.click(await screen.findByRole('button', { name: 'Rangpur', pressed: false }))
    await userEvent.click(screen.getByRole('button', { name: 'Dinajpur' }))
    expect(await screen.findByText('Near Dinajpur, Rangpur division')).toBeInTheDocument()
    expect(screen.getByText(/In Dinajpur town/)).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'tap Dinajpur field' }))
    expect(await screen.findByText(/14 km from Dinajpur town/)).toBeInTheDocument()
    await userEvent.click(next())

    // 2. Crop
    expect(screen.getByRole('heading', { name: 'What do you grow there?' })).toBeInTheDocument()
    expect(next()).toBeDisabled()
    await userEvent.click(screen.getByRole('radio', { name: /Maize/ }))
    await userEvent.click(next())

    // 3. Name, then save
    await userEvent.type(screen.getByRole('textbox', { name: 'Field name' }), 'North field')
    await userEvent.click(screen.getByRole('button', { name: 'Save my farm' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
    expect(router.state.location.search).toBe('?farm=my_25.5710_88.7649_maize')
    expect(myFarms.list()).toEqual([
      expect.objectContaining({ id: 'my_25.5710_88.7649_maize', name: 'North field', cropId: 'maize', district: 'Dinajpur', districtBn: 'দিনাজপুর', division: 'Rangpur' }),
    ])
  }, 15_000) // long multi-step flow

  it('names the field after its crop when the farmer skips the name', async () => {
    renderPage('/farms/new?lat=25.571&lon=88.7649') // e.g. "Add a farm here" on the map
    expect(await screen.findByText('Near Dinajpur, Rangpur division')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('radio', { name: /Aman rice/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save my farm' }))
    await waitFor(() => expect(myFarms.list()[0]?.name).toBe('My aman rice field'))
  })

  it('refuses places outside Bangladesh', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'tap Kolkata' }))
    expect(screen.getByText(/outside Bangladesh/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('uses the phone’s location, and explains when permission is refused', async () => {
    const getCurrentPosition = vi
      .fn()
      .mockImplementationOnce((ok: PositionCallback) => ok({ coords: { latitude: 25.63, longitude: 88.64 } } as GeolocationPosition))
      .mockImplementationOnce((_ok: PositionCallback, fail: PositionErrorCallback) =>
        fail({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
      )
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Use my location' }))
    expect(screen.getByTestId('pin')).toHaveTextContent('25.63,88.64')
    expect(await screen.findByText('Near Dinajpur, Rangpur division')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Use my location' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Location permission was refused')
  })

  it('works in Bengali', async () => {
    renderPage('/farms/new?lat=25.63&lon=88.64')
    await userEvent.click(screen.getByRole('radio', { name: 'বাংলা' }))
    expect(screen.getByRole('heading', { level: 1, name: 'আমার জমি যোগ করুন' })).toBeInTheDocument()
    expect(await screen.findByText('দিনাজপুরের কাছে, রংপুর বিভাগ')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'পরের ধাপ' }))
    await userEvent.click(screen.getByRole('radio', { name: /ভুট্টা/ }))
    await userEvent.click(screen.getByRole('button', { name: 'পরের ধাপ' }))
    expect(screen.getByRole('textbox', { name: 'জমির নাম' })).toHaveAttribute('placeholder', 'আমার ভুট্টার জমি')
  })
})
