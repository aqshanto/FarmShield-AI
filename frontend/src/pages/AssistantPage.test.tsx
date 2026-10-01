import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { farmsFixture, makeDashboard } from '@/test/fixtures'
import { sseResponse } from '@/test/sse'
import { AssistantPage } from './AssistantPage'

type Reply = { engine?: 'claude' | 'offline'; chunks?: string[]; status?: number; replace?: string }

let reply: Reply
let chatBodies: { farm_id: string; lang: string; messages: { role: string; content: string }[] }[]

function sse(r: Reply) {
  const engine = r.engine ?? 'offline'
  const parts = [`event: meta\ndata: ${JSON.stringify({ engine, lang: 'en' })}\n\n`]
  for (const text of r.chunks ?? []) parts.push(`event: delta\ndata: ${JSON.stringify({ text })}\n\n`)
  if (r.replace) parts.push(`event: replace\ndata: ${JSON.stringify({ text: r.replace, engine: 'offline' })}\n\n`)
  parts.push(`event: done\ndata: ${JSON.stringify({ engine: r.replace ? 'offline' : engine })}\n\n`)
  return sseResponse(parts)
}

function mockApi() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    if (url === '/api/v1/farms') return json(farmsFixture)
    if (url === '/api/v1/assistant/status') return json({ engine: reply.engine ?? 'offline', label: 'x', languages: ['en', 'bn'] })
    if (url === '/api/v1/assistant/chat') {
      chatBodies.push(JSON.parse(String(init?.body)))
      return reply.status ? json({ detail: 'down' }, reply.status) : sse(reply)
    }
    const farm = farmsFixture.find((f) => url === `/api/v1/farms/${f.id}/dashboard`)
    return farm ? json(makeDashboard(farm)) : json({ detail: 'not found' }, 404)
  })
}

function renderAt(url = '/assistant') {
  const router = createMemoryRouter(
    [
      { path: '/assistant', element: <AssistantPage /> },
      { path: '/dashboard', element: <p>dashboard</p> },
    ],
    { initialEntries: [url] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const conversation = () => screen.getByRole('list', { name: /Ask FarmShield|ফার্মশিল্ডকে জিজ্ঞেস করুন/ })

beforeEach(() => {
  localStorage.clear()
  reply = { chunks: ['Soil is drying. ', 'Check it in 2–3 days.'] }
  chatBodies = []
  mockApi()
})

afterEach(() => {
  delete (window as { SpeechRecognition?: unknown }).SpeechRecognition
  delete (window as { speechSynthesis?: unknown }).speechSynthesis
})

describe('AssistantPage', () => {
  it('greets the farmer about the selected farm and shows the helper in use', async () => {
    renderAt()
    expect(screen.getByRole('heading', { level: 1, name: 'Ask FarmShield' })).toBeInTheDocument()
    expect(await within(conversation()).findByText(/watching Haor Rice Field from space/)).toBeInTheDocument()
    expect(await screen.findByText('Built-in helper')).toBeInTheDocument()
    expect(await screen.findByText('Looking at:')).toBeInTheDocument()
    // Suggestions lead with the day's summary, then the farm's worst risk (flood).
    const chips = screen.getAllByRole('button', { name: /\?$/ })
    expect(chips.map((c) => c.textContent).slice(0, 2)).toEqual(['What should I do today?', 'Is there flood danger this week?'])
  })

  it('asks a suggested question and streams the answer', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Should I irrigate today?' }))

    const list = conversation()
    expect(within(list).getByText('Should I irrigate today?')).toBeInTheDocument()
    expect(await within(list).findByText('Soil is drying. Check it in 2–3 days.')).toBeInTheDocument()
    expect(within(list).getByText('Quick answer')).toBeInTheDocument()
    expect(chatBodies[0]).toEqual({ farm_id: 'haor', lang: 'en', messages: [{ role: 'user', content: 'Should I irrigate today?' }] })
  })

  it('sends typed questions with the conversation so far (without the greeting)', async () => {
    reply = { engine: 'claude', chunks: ['Yes, water tonight.'] }
    renderAt('/assistant?farm=barind')
    const box = await screen.findByRole('textbox', { name: 'Type your question…' })

    await userEvent.type(box, 'Is it too hot?{Enter}')
    expect(await screen.findByText('Yes, water tonight.')).toBeInTheDocument()
    expect(box).toHaveValue('')
    await userEvent.type(box, 'When?{Enter}')

    await waitFor(() => expect(chatBodies).toHaveLength(2))
    expect(chatBodies[1].farm_id).toBe('barind')
    expect(chatBodies[1].messages).toEqual([
      { role: 'user', content: 'Is it too hot?' },
      { role: 'assistant', content: 'Yes, water tonight.' },
      { role: 'user', content: 'When?' },
    ])
    expect(screen.getAllByText('Claude AI').length).toBeGreaterThan(0)
  })

  it('switches the whole screen to Bengali and remembers the choice', async () => {
    renderAt()
    await userEvent.click(screen.getByRole('radio', { name: 'বাংলা' }))

    expect(screen.getByRole('heading', { level: 1, name: 'ফার্মশিল্ডকে জিজ্ঞেস করুন' })).toBeInTheDocument()
    expect(await within(conversation()).findByText(/সুনামগঞ্জ দেখছি/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'আজ কি সেচ দেব?' })).toBeInTheDocument()
    expect(localStorage.getItem('farmshield-lang')).toBe('bn')

    await userEvent.click(screen.getByRole('button', { name: 'আমার ফসল কেমন আছে?' }))
    await waitFor(() => expect(chatBodies[0]?.lang).toBe('bn'))
  })

  it('shows the fallback answer when Claude fails mid-reply', async () => {
    reply = { engine: 'claude', chunks: ['Half an ans'], replace: 'Little rain is expected.' }
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Will it rain this week?' }))
    expect(await screen.findByText('Little rain is expected.')).toBeInTheDocument()
    expect(screen.queryByText('Half an ans')).not.toBeInTheDocument()
  })

  it('apologises in a friendly way when the backend is down', async () => {
    reply = { status: 503 }
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Is my crop healthy?' }))
    expect(await screen.findByText(/couldn’t reach the farm brain/)).toBeInTheDocument()
    // The composer is usable again.
    expect(screen.getByRole('button', { name: 'What should I do today?' })).toBeEnabled()
  })

  it('starts a new chat for a different farm', async () => {
    const router = renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Should I irrigate today?' }))
    await screen.findByText('Soil is drying. Check it in 2–3 days.')

    await userEvent.click(screen.getByRole('button', { name: 'Rajshahi' }))
    expect(router.state.location.search).toBe('?farm=barind')
    expect(await within(conversation()).findByText(/watching Barind Wheat Farm/)).toBeInTheDocument()
    expect(screen.queryByText('Soil is drying. Check it in 2–3 days.')).not.toBeInTheDocument()
  })

  it('takes a spoken question and reads the answer aloud', async () => {
    let recognition: { onresult: (e: unknown) => void; onend: () => void; lang: string } | undefined
    class FakeRecognition {
      lang = ''
      interimResults = false
      continuous = false
      onresult = () => {}
      onerror = () => {}
      onend = () => {}
      start = vi.fn(() => {
        recognition = this as never
      })
      stop = vi.fn()
      abort = vi.fn()
    }
    ;(window as { SpeechRecognition?: unknown }).SpeechRecognition = FakeRecognition
    const speak = vi.fn()
    ;(window as { speechSynthesis?: unknown }).speechSynthesis = {
      getVoices: () => [{ lang: 'en-US', name: 'English' }],
      speak,
      cancel: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    ;(globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = class {
      text: string
      constructor(text: string) {
        this.text = text
      }
    }

    renderAt()
    await screen.findByText('Built-in helper')
    await userEvent.click(screen.getByRole('button', { name: 'Ask by voice' }))
    expect(recognition?.lang).toBe('en-US')
    expect(screen.getByRole('button', { name: 'Stop listening' })).toHaveAttribute('aria-pressed', 'true')

    act(() => {
      recognition!.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Will it flood?' } }] })
      recognition!.onend()
    })

    expect(await screen.findByText('Soil is drying. Check it in 2–3 days.')).toBeInTheDocument()
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1))
    expect(speak.mock.calls[0][0].text).toBe('Soil is drying. Check it in 2–3 days.')
    expect(chatBodies[0].messages).toEqual([{ role: 'user', content: 'Will it flood?' }])
  })
})
