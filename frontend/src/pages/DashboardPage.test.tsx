import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast/ToastProvider'
import { myFarms } from '@/lib/myFarms'
import { farmsFixture, makeDashboard, mockDashboardApi } from '@/test/fixtures'
import { DashboardPage } from './DashboardPage'

function renderAt(url: string) {
  const router = createMemoryRouter([{ path: '/dashboard', element: <DashboardPage /> }], { initialEntries: [url] })
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
  mockDashboardApi(vi.spyOn(globalThis, 'fetch'))
})

describe('DashboardPage', () => {
  it('shows a skeleton, then the first farm with overall risk, tasks, risks and forecast', async () => {
    renderAt('/dashboard')
    expect(screen.getByRole('status', { name: 'Loading your farm' })).toBeInTheDocument()

    expect(await screen.findByRole('heading', { level: 1, name: 'Haor Rice Field' })).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'Overall farm risk' })).toHaveAttribute('aria-valuenow', '83')
    expect(screen.getByRole('heading', { name: 'Act today: flood risk is high.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What to do this week' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Flood risk: Danger/ })).toBeInTheDocument()
    expect(screen.getByText('1 heavy rain day')).toBeInTheDocument()
  })

  it('switching farm updates the URL and loads the new farm', async () => {
    const router = renderAt('/dashboard')
    await screen.findByRole('heading', { level: 1, name: 'Haor Rice Field' })

    await userEvent.click(screen.getByRole('button', { name: 'Rajshahi' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Barind Wheat Farm' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?farm=barind')
  })

  it('opens and closes the risk detail panel with the trend chart', async () => {
    renderAt('/dashboard')
    const card = await screen.findByRole('button', { name: /Flood risk: Danger/ })
    expect(card).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(card)
    expect(card).toHaveAttribute('aria-expanded', 'true')
    const panel = await screen.findByRole('heading', { name: 'Flood risk: why?' })
    expect(panel).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Flood risk risk, last 14 days' })).toBeInTheDocument()
    expect(screen.getByText('Rainfall measured from space, every 30 minutes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Close details' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Flood risk: why?' })).not.toBeInTheDocument())
  })

  it('ticking a task updates progress, celebrates, sinks it and remembers it', async () => {
    renderAt('/dashboard')
    const checkbox = await screen.findByRole('checkbox', { name: /Harvest ripe rice now/ })
    expect(screen.getByRole('progressbar', { name: 'Tasks done' })).toHaveAttribute('aria-valuenow', '0')

    await userEvent.click(checkbox)

    expect(checkbox).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('progressbar', { name: 'Tasks done' })).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByText('“Harvest ripe rice now” is done.')).toBeInTheDocument()
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes[boxes.length - 1]).toBe(checkbox)
    expect(JSON.parse(localStorage.getItem('farmshield:done:haor') ?? '[]')).toEqual(['r1'])
  })

  it('restores ticked tasks from a previous visit', async () => {
    localStorage.setItem('farmshield:done:haor', JSON.stringify(['r2']))
    renderAt('/dashboard')
    expect(await screen.findByRole('checkbox', { name: /Clear drainage channels/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
  })

  it('explains an unknown farm link and offers a way back', async () => {
    const router = renderAt('/dashboard?farm=nowhere')
    const card = (await screen.findByRole('heading', { name: 'We couldn’t find that farm' })).closest('div')!
    expect(within(card).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Show my first farm' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Haor Rice Field' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('offers retry when the backend is down', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    renderAt('/dashboard')
    expect(await screen.findByRole('heading', { name: 'We couldn’t load your farm' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('DashboardPage with my own farm', () => {
  const MY_ID = 'my_25.5710_88.7649_maize'

  function saveMyFarm() {
    myFarms.save({
      id: MY_ID,
      name: 'North field',
      cropId: 'maize',
      cropName: 'Maize',
      cropNameBn: 'ভুট্টা',
      lat: 25.571,
      lon: 88.7649,
      district: 'Dinajpur',
      districtBn: 'দিনাজপুর',
      division: 'Rangpur',
    })
  }

  function mockWithMyFarm(myResponse: () => Response) {
    vi.restoreAllMocks()
    const fixtures = vi.fn()
    mockDashboardApi({ mockImplementation: (fn) => fixtures.mockImplementation(fn) })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      return url.startsWith(`/api/v1/farms/${MY_ID}/dashboard`) ? myResponse() : fixtures(input, init)
    })
  }

  const myDashboard = () => {
    const d = makeDashboard({ ...farmsFixture[0], id: MY_ID, name: 'My maize field', district: 'Dinajpur', crop: 'Maize' })
    return new Response(JSON.stringify({ ...d, farm: { ...d.farm, division: 'Rangpur', area_acres: null, custom: true } }))
  }

  it('opens the farmer’s own field first, with its name and no made-up size', async () => {
    saveMyFarm()
    mockWithMyFarm(myDashboard)
    renderAt('/dashboard')
    expect(await screen.findByRole('heading', { level: 1, name: 'North field' })).toBeInTheDocument()
    expect(screen.getByText('My farm')).toBeInTheDocument()
    expect(screen.getByText('Near Dinajpur, Rangpur')).toBeInTheDocument()
    expect(screen.queryByText(/acres/)).not.toBeInTheDocument()
    const picker = screen.getByRole('group', { name: 'Choose a farm' })
    expect(within(picker).getAllByRole('button').map((b) => b.textContent)).toEqual(['North field', 'Sunamganj', 'Rajshahi'])
    expect(within(picker).getByRole('link', { name: /Add my farm/ })).toHaveAttribute('href', '/farms/new')
    // The saved name is sent so the server labels the farm the same way.
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u) === `/api/v1/farms/${MY_ID}/dashboard?name=North%20field`)).toBe(true)
  })

  it('renames and removes a field', async () => {
    saveMyFarm()
    mockWithMyFarm(myDashboard)
    const router = renderAt('/dashboard')
    await screen.findByRole('heading', { level: 1, name: 'North field' })

    await userEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const input = await screen.findByRole('textbox', { name: 'Field name' })
    await userEvent.clear(input)
    await userEvent.type(input, 'River field{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'River field' })).toBeInTheDocument()
    expect(myFarms.get(MY_ID)?.name).toBe('River field')

    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }))
    expect(await screen.findByText('Remove this farm from this device?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(router.state.location.search).toBe('?farm=haor'))
    expect(myFarms.list()).toEqual([])
  }, 15_000) // long multi-step flow

  it('shows the server’s reason when a new field’s data is still downloading', async () => {
    saveMyFarm()
    mockWithMyFarm(() => new Response(JSON.stringify({ detail: 'Still downloading NASA data for this field. Try again in a moment.' }), { status: 503 }))
    renderAt(`/dashboard?farm=${MY_ID}`)
    expect(await screen.findByText('Still downloading NASA data for this field. Try again in a moment.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
