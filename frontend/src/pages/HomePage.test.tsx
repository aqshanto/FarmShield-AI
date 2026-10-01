import { render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mapOverviewFixture } from '@/test/fixtures'
import { HomePage } from './HomePage'

function renderHome() {
  render(<RouterProvider router={createMemoryRouter([{ path: '/', element: <HomePage /> }])} />)
}

function mockOverview(ok = true) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    ok ? new Response(JSON.stringify(mapOverviewFixture)) : new Response('down', { status: 503 }),
  )
}

beforeEach(() => mockOverview())

describe('HomePage', () => {
  it('tells the story with clear calls to action', () => {
    renderHome()
    expect(screen.getByRole('heading', { level: 1, name: 'FarmShield AI' })).toBeInTheDocument()
    expect(screen.getByText('Satellite eyes for every farm.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /See a live farm/ })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: /Ask in বাংলা/ })).toHaveAttribute('href', '/assistant')
    expect(screen.getByRole('link', { name: /Explore the map/ })).toHaveAttribute('href', '/map')
    expect(screen.getByRole('heading', { name: 'From space to the field, in time to act' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toContain('Ask in your own language')
  })

  it('shows what is being watched and each farm’s live risk', async () => {
    renderHome()
    const farm = await screen.findByRole('heading', { level: 3, name: 'Barind Wheat Farm' })
    const card = farm.closest('li')!
    expect(within(card).getByText('Act today: water stress is high.')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: /Open farm/ })).toHaveAttribute('href', '/dashboard?farm=barind')
    expect(within(card).getByRole('link', { name: /Ask/ })).toHaveAttribute('href', '/assistant?farm=barind')
    const risks = within(card).getByRole('list', { name: 'Barind Wheat Farm risks' })
    expect(within(risks).getByText('Danger')).toBeInTheDocument()
    expect(screen.getByText('land areas checked across Bangladesh')).toBeInTheDocument()
  })

  it('keeps the story but hides the farm cards when the backend is unreachable', async () => {
    vi.restoreAllMocks()
    mockOverview(false)
    renderHome()
    // Skeleton cards while loading, then the section steps aside once the request fails.
    expect(screen.getByRole('status', { name: 'Loading farms' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Three farms, three different stories' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'From space to the field, in time to act' })).toBeInTheDocument()
  })
})
