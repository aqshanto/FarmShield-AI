import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '@/lib/i18n'
import { myFarms } from '@/lib/myFarms'
import { farmsFixture } from '@/test/fixtures'
import type { RotationPlan, RotationStrategy } from '@/types/api'
import { RotationPage } from './RotationPage'

const scores = (n: number) => ({ soil: n, water: n, climate: n, pests: n, income: n, food: n })

function strategy(id: string, name: string, overall: number, extra: Partial<RotationStrategy> = {}): RotationStrategy {
  return {
    id,
    name,
    existing: false,
    verdict: 'Better than now',
    overall,
    scores: scores(overall),
    irrigation_mm: 200,
    bare_months: [2, 6],
    crops: [
      { id: 'mustard', name: 'Mustard', months: [11, 12, 1] },
      { id: 'aman', name: 'Aman rice', months: [7, 8, 9, 10] },
    ],
    why: ['Better for the soil than your rotation now'],
    evidence: ['From November to January this place usually gets 12 mm of rain a month (NASA POWER)'],
    benefits: ['Mustard breaks the pest and disease cycle of the cereals around it'],
    gaps: ["We don't know your soil type or test results: a soil test would sharpen this"],
    risks: ['Early monsoon rain can spoil mungbean pods at harvest'],
    ...extra,
  }
}

function makePlan(url: URL): RotationPlan {
  const priorities = (url.searchParams.get('priorities') ?? '').split(',').filter(Boolean) as RotationPlan['priorities']
  const existingId = url.searchParams.get('existing') ?? 'boro-fallow-aman'
  const bn = url.searchParams.get('lang') === 'bn'
  const ideas = priorities.includes('income')
    ? [strategy('potato-boro-aman', 'Potato → Boro rice → Aman rice', 70)]
    : [strategy('mustard-mungbean-aman', 'Mustard → Mungbean → Aman rice', 88, { verdict: 'Best match for your priorities' })]
  return {
    farm_id: 'haor',
    crop: 'Boro rice',
    in_bangladesh: true,
    priorities,
    irrigation: url.searchParams.get('irrigation') !== 'false',
    existing_id: existingId,
    existing_options: [
      { id: 'boro-fallow-aman', name: 'Boro rice → Aman rice' },
      { id: 'wheat-fallow-aman', name: 'Wheat → Aman rice' },
    ],
    strategies: [
      strategy(existingId, bn ? 'বোরো ধান → আমন ধান' : existingId === 'wheat-fallow-aman' ? 'Wheat → Aman rice' : 'Boro rice → Aman rice', 46, {
        existing: true,
        verdict: bn ? 'আপনার এখনকার ফসলচক্র' : 'Your rotation now',
        bare_months: [5, 6, 11, 12],
      }),
      ...ideas,
      strategy('lentil-jute-aman', 'Lentil → Jute → Aman rice', 85),
      strategy('wheat-mungbean-aman', 'Wheat → Mungbean → Aman rice', 40, { verdict: 'Weaker than now' }),
    ],
    climate: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, rain_mm: [10, 20, 40, 120, 300, 450, 460, 360, 300, 180, 30, 10][i], tmax: 30, tmin: 20 })),
    wet_months: [5, 6, 7, 8, 9],
    field_notes: ['The field sits 8 m above sea level: low land that floods in the monsoon (NASA SRTM)'],
    sources: [],
  }
}

// Haor land: under water May–October, so only dry-season crops are planned.
function haorPlan(url: URL): RotationPlan {
  const boro = { id: 'boro', name: 'Boro rice', months: [1, 2, 3, 4] }
  return {
    ...makePlan(url),
    existing_id: 'boro-haor',
    existing_options: [
      { id: 'boro-haor', name: 'Boro rice' },
      { id: 'mustard-boro-haor', name: 'Mustard → Boro rice' },
    ],
    strategies: [
      strategy('boro-haor', 'Boro rice', 46, { existing: true, verdict: 'Your rotation now', bare_months: [11, 12], crops: [boro] }),
      strategy('mustard-boro-haor', 'Mustard → Boro rice', 62, {
        verdict: 'Best match for your priorities',
        bare_months: [],
        crops: [{ id: 'mustard', name: 'Mustard', months: [11, 12] }, boro],
      }),
    ],
    flood_months: [5, 6, 7, 8, 9, 10],
    field_notes: ['In the flood months the haor gives fish, not crops, so every idea here uses the dry months only'],
  }
}

let fetchSpy: ReturnType<typeof vi.spyOn>
let rotationStatus = 200
let haorLand = false

beforeEach(() => {
  localStorage.clear()
  myFarms.reset()
  setLang('en')
  rotationStatus = 200
  haorLand = false
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://test')
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    if (url.pathname === '/api/v1/farms') return json(farmsFixture)
    if (/^\/api\/v1\/farms\/[^/]+\/rotation$/.test(url.pathname)) {
      if (rotationStatus !== 200) return json({ detail: 'nope' }, rotationStatus)
      return json(haorLand ? haorPlan(url) : makePlan(url))
    }
    return json({ detail: 'not found' }, 404)
  })
})

function renderAt(url = '/rotation') {
  const router = createMemoryRouter([{ path: '/rotation', element: <RotationPage /> }], { initialEntries: [url] })
  render(<RouterProvider router={router} />)
  return router
}

const rotationCalls = () => fetchSpy.mock.calls.map((c: unknown[]) => String(c[0])).filter((u: string) => u.includes('/rotation'))

describe('RotationPage', () => {
  it('compares the current rotation with the ideas, with NASA evidence and the farmer-first note', async () => {
    renderAt()
    expect(await screen.findByRole('heading', { level: 3, name: 'Boro rice → Aman rice' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(4)
    expect(screen.getByText('Your rotation now')).toBeInTheDocument()
    expect(screen.getByText('Best match for your priorities')).toBeInTheDocument()
    expect(screen.getAllByRole('meter', { name: /Match/ })[1]).toHaveAttribute('aria-valuenow', '88')
    expect(screen.getByText('Field bare 4 months')).toBeInTheDocument()
    expect(screen.getAllByText(/NASA POWER/).length).toBeGreaterThan(0)
    expect(screen.getByText(/low land that floods in the monsoon/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your judgment comes first' })).toBeInTheDocument()
    expect(rotationCalls()[0]).toBe('/api/v1/farms/haor/rotation?priorities=&irrigation=true')
  })

  it('priorities, irrigation and the current rotation each ask for new ideas', async () => {
    renderAt('/rotation?farm=barind')
    await screen.findByRole('heading', { level: 3, name: 'Boro rice → Aman rice' })

    await userEvent.click(screen.getByRole('button', { name: 'More income' }))
    expect(screen.getByRole('button', { name: 'More income' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { level: 3, name: 'Potato → Boro rice → Aman rice' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'No' }))
    await waitFor(() => expect(rotationCalls().at(-1)).toContain('irrigation=false'))

    await userEvent.selectOptions(screen.getByLabelText('What do you grow now?'), 'wheat-fallow-aman')
    expect(await screen.findByRole('heading', { level: 3, name: 'Wheat → Aman rice' })).toBeInTheDocument()
    expect(rotationCalls().at(-1)).toBe('/api/v1/farms/barind/rotation?priorities=income&irrigation=false&existing=wheat-fallow-aman')
  })

  it('the farmer can say what their soil is like', async () => {
    renderAt('/rotation?farm=barind')
    await screen.findByRole('heading', { level: 3, name: 'Boro rice → Aman rice' })
    expect(screen.getByRole('radio', { name: 'Not sure' })).toBeChecked()
    expect(screen.getByText(/Rub some moist soil/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'Sandy' }))
    await waitFor(() => expect(rotationCalls().at(-1)).toBe('/api/v1/farms/barind/rotation?priorities=&irrigation=true&soil=sandy'))
    expect(await screen.findByText(/Gritty, and dries out fast/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'Not sure' }))
    await waitFor(() => expect(rotationCalls().at(-1)).toBe('/api/v1/farms/barind/rotation?priorities=&irrigation=true'))
  })

  it('opens benefits, gaps and local risks on demand', async () => {
    renderAt()
    const card = (await screen.findAllByRole('article'))[1]
    expect(within(card).queryByText('What it may offer')).not.toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'Benefits, gaps and risks' }))
    expect(within(card).getByText('What it may offer')).toBeInTheDocument()
    expect(within(card).getByText(/a soil test would sharpen this/)).toBeInTheDocument()
    expect(within(card).getByText('Early monsoon rain can spoil mungbean pods at harvest')).toBeInTheDocument()
  })

  it('pointing at a month reads out its normal rain and heat', async () => {
    renderAt()
    await screen.findAllByRole('article')
    await userEvent.click(screen.getByRole('button', { name: /^April: about 120 mm/ }))
    expect(screen.getByText('April: about 120 mm of rain, days around 30°C')).toBeInTheDocument()
  })

  it('shows haor flood months as water, not as a bare field', async () => {
    haorLand = true
    renderAt()
    expect(await screen.findByRole('heading', { level: 3, name: 'Boro rice' })).toBeInTheDocument()
    expect(screen.getAllByText('Under water · May–Oct')).toHaveLength(2)
    expect(screen.getByText('Field bare 2 months')).toBeInTheDocument()
    expect(screen.getByText('Never bare')).toBeInTheDocument()
    expect(screen.getByText(/Boro rice: Jan–Apr; Under water: May–Oct; Bare: Nov, Dec/)).toBeInTheDocument()
    expect(screen.getByText(/the haor gives fish, not crops/)).toBeInTheDocument()
  })

  it('speaks Bengali', async () => {
    setLang('bn')
    renderAt()
    expect(await screen.findByRole('heading', { level: 1, name: 'আগামী বছরের ফসল পরিকল্পনা' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 3, name: 'বোরো ধান → আমন ধান' })).toBeInTheDocument()
    expect(rotationCalls().at(-1)).toContain('lang=bn')
  })

  it('explains when the server runs the demo scenario', async () => {
    rotationStatus = 409
    renderAt()
    expect(await screen.findByText(/needs live NASA data/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })
})
