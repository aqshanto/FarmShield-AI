import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SystemStatusPanel } from './SystemStatusPanel'

const responses: Record<string, unknown> = {
  '/api/v1/health': { status: 'ok', app: 'FarmShield AI', version: '0.1.0', environment: 'development', data_mode: 'sample' },
  '/api/v1/sources': ['smap', 'gpm', 'modis', 'viirs'].map((id) => ({
    id,
    name: id.toUpperCase(),
    full_name: id,
    measures: 'x',
    used_for: [],
  })),
  '/api/v1/region/default': { name: 'Bangladesh', lat: 23.7, lon: 90.4, zoom: 7 },
}

function mockBackendOnline() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
    new Response(JSON.stringify(responses[String(input)]), { status: 200 }),
  )
}

describe('SystemStatusPanel', () => {
  it('shows NASA sources and the focus region when the backend is online', async () => {
    mockBackendOnline()
    render(<SystemStatusPanel />)

    for (const name of ['SMAP', 'GPM', 'MODIS', 'VIIRS']) {
      expect(await screen.findByText(name)).toBeInTheDocument()
    }
    expect(screen.getByText('Bangladesh')).toBeInTheDocument()
    expect(screen.getByText(/API v0\.1\.0/)).toBeInTheDocument()
  })

  it('retries silently while the backend is still booting', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    render(<SystemStatusPanel retryPolicy={{ attempts: 3, delayMs: 20 }} />)

    fetchMock.mockRestore()
    mockBackendOnline()

    expect(await screen.findByText('Bangladesh')).toBeInTheDocument()
    expect(screen.queryByText(/backend is sleeping/i)).not.toBeInTheDocument()
  })

  it('shows a friendly message and recovers after retry when the backend is offline', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    render(<SystemStatusPanel retryPolicy={{ attempts: 0, delayMs: 0 }} />)

    expect(await screen.findByText(/backend is sleeping/i)).toBeInTheDocument()

    fetchMock.mockRestore()
    mockBackendOnline()
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText('Bangladesh')).toBeInTheDocument()
  })
})
