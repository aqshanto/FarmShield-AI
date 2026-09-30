import { describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './api'

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
