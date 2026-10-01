import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import { useAsync } from './useAsync'

describe('useAsync', () => {
  it('goes from loading to success', async () => {
    const { result } = renderHook(() => useAsync('a', async () => 'hello'))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toBe('hello')
  })

  it('does nothing while the key is null', () => {
    const load = vi.fn(async () => 1)
    const { result } = renderHook(() => useAsync(null, load))
    expect(load).not.toHaveBeenCalled()
    expect(result.current.status).toBe('loading')
  })

  it('keeps previous data while the next key loads', async () => {
    let resolveSecond: (v: string) => void = () => {}
    const load = vi.fn((key: string) =>
      key === 'first' ? Promise.resolve('one') : new Promise<string>((resolve) => (resolveSecond = resolve)),
    )
    const { result, rerender } = renderHook(({ k }) => useAsync(k, () => load(k)), { initialProps: { k: 'first' } })
    await waitFor(() => expect(result.current.data).toBe('one'))

    rerender({ k: 'second' })
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBe('one')

    await act(async () => resolveSecond('two'))
    expect(result.current).toMatchObject({ status: 'success', data: 'two' })
  })

  it('reports errors and recovers on retry', async () => {
    let fail = true
    const { result } = renderHook(() =>
      useAsync('k', async () => {
        if (fail) throw new Error('boom')
        return 'ok'
      }),
    )
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error?.message).toBe('boom')

    fail = false
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toBe('ok')
  })

  it('aborts the previous request when the key changes', async () => {
    const signals: AbortSignal[] = []
    const { rerender } = renderHook(({ k }) => useAsync(k, (signal) => (signals.push(signal), new Promise(() => {}))), {
      initialProps: { k: 'a' },
    })
    rerender({ k: 'b' })
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })
})

describe('useAsync retries', () => {
  it('quietly retries server errors (e.g. API still starting) and stays loading meanwhile', async () => {
    let calls = 0
    const load = vi.fn(async () => {
      calls += 1
      if (calls < 3) throw new ApiError(502, 'starting')
      return 'up'
    })
    const { result } = renderHook(() => useAsync('k', load, { retries: 5, retryDelayMs: 5 }))
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toBe('up')
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('does not retry a 4xx and reports the error', async () => {
    const load = vi.fn(async () => {
      throw new ApiError(404, 'missing')
    })
    const { result } = renderHook(() => useAsync('k', load, { retries: 5, retryDelayMs: 5 }))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('gives up after the allowed retries', async () => {
    const load = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const { result } = renderHook(() => useAsync('k', load, { retries: 2, retryDelayMs: 5 }))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(load).toHaveBeenCalledTimes(3)
  })
})
