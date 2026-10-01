import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ApiError } from './api'

export type AsyncState<T> =
  | { status: 'loading'; data: T | undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data: T | undefined; error: Error }

interface Result<T> {
  // Which request this result answers; if it isn't the current one, we're loading.
  request: string | null
  data?: T
  error?: Error
}

interface Options {
  // Quietly retry server and network failures (not 4xx) before showing an error, e.g.
  // while the API is still starting. Waits retryDelayMs, 2×, 3×… between attempts.
  retries?: number
  retryDelayMs?: number
}

const retryable = (error: unknown) => !(error instanceof ApiError && error.status < 500)
// Tests exercise the same retries without waiting for real time to pass.
const DEFAULT_RETRY_DELAY_MS = import.meta.env.MODE === 'test' ? 1 : 1500

/**
 * Runs `load` whenever `key` changes (null = don't run). Previous data is kept while the
 * next request loads, so screens can dim stale content instead of flashing to empty.
 */
export function useAsync<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, options: Options = {}) {
  const [result, setResult] = useState<Result<T>>({ request: null })
  const [run, setRun] = useState(0)
  const request = key === null ? null : `${run}:${key}`

  const loadRef = useRef(load)
  const optionsRef = useRef(options)
  useLayoutEffect(() => {
    loadRef.current = load
    optionsRef.current = options
  })

  useEffect(() => {
    if (request === null) return
    const controller = new AbortController()
    const { retries = 0, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = optionsRef.current
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const attemptLoad = () =>
      loadRef.current(controller.signal)
        .then((data) => setResult({ request, data }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          if (attempt < retries && retryable(error)) {
            attempt += 1
            timer = setTimeout(attemptLoad, retryDelayMs * attempt)
            return
          }
          setResult((prev) => ({
            request,
            data: prev.data,
            error: error instanceof Error ? error : new Error(String(error)),
          }))
        })
    attemptLoad()

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [request])

  const retry = useCallback(() => setRun((n) => n + 1), [])

  let state: AsyncState<T>
  if (request === null || result.request !== request) state = { status: 'loading', data: result.data }
  else if (result.error) state = { status: 'error', data: result.data, error: result.error }
  else state = { status: 'success', data: result.data as T }

  return { ...state, retry }
}
