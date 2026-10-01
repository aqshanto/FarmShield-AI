import { afterEach, describe, expect, it, vi } from 'vitest'
import { sseResponse } from '@/test/sse'
import type { ChatEvent } from '@/types/api'
import { api, ApiError, streamChat } from './api'

afterEach(() => vi.restoreAllMocks())

describe('api client', () => {
  it('requests the versioned API path and parses JSON', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))

    const result = await api.health()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/health', expect.objectContaining({}))
    expect(result).toEqual({ status: 'ok' })
  })

  it('throws ApiError with the status code on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 503 }))

    await expect(api.sources()).rejects.toMatchObject({ name: 'ApiError', status: 503 })
    await expect(api.sources()).rejects.toBeInstanceOf(ApiError)
  })
})

describe('streamChat', () => {
  it('posts the question and yields events, even when they are split across chunks', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse([
        'event: meta\ndata: {"engine":"offline","lang":"bn"}\n\nevent: del',
        'ta\ndata: {"text":"আজ "}\n\n',
        'event: delta\ndata: {"text":"সেচ দিন।"}\n\nevent: done\ndata: {"engine":"offline"}\n\n',
      ]),
    )
    const events: ChatEvent[] = []
    for await (const ev of streamChat({ farm_id: 'haor', lang: 'bn', messages: [{ role: 'user', content: 'সেচ?' }] })) events.push(ev)

    expect(events).toEqual([
      { event: 'meta', data: { engine: 'offline', lang: 'bn' } },
      { event: 'delta', data: { text: 'আজ ' } },
      { event: 'delta', data: { text: 'সেচ দিন।' } },
      { event: 'done', data: { engine: 'offline' } },
    ])
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/v1/assistant/chat')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ farm_id: 'haor', lang: 'bn', messages: [{ role: 'user', content: 'সেচ?' }] })
  })

  it('throws an ApiError when the server refuses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"detail":"nope"}', { status: 404 }))
    const run = async () => {
      for await (const ev of streamChat({ farm_id: 'x', lang: 'en', messages: [{ role: 'user', content: 'hi' }] })) void ev
    }
    await expect(run()).rejects.toBeInstanceOf(ApiError)
  })
})
