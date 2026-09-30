import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

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

/**
 * Runs `load` whenever `key` changes (null = don't run). Previous data is kept while the
 * next request loads, so screens can dim stale content instead of flashing to empty.
 */
export function useAsync<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const [result, setResult] = useState<Result<T>>({ request: null })
  const [run, setRun] = useState(0)
  const request = key === null ? null : `${run}:${key}`

  const loadRef = useRef(load)
  useLayoutEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    if (request === null) return
    const controller = new AbortController()

    loadRef.current(controller.signal)
      .then((data) => setResult({ request, data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setResult((prev) => ({
          request,
          data: prev.data,
          error: error instanceof Error ? error : new Error(String(error)),
        }))
      })

    return () => controller.abort()
  }, [request])

  const retry = useCallback(() => setRun((n) => n + 1), [])

  let state: AsyncState<T>
  if (request === null || result.request !== request) state = { status: 'loading', data: result.data }
  else if (result.error) state = { status: 'error', data: result.data, error: result.error }
  else state = { status: 'success', data: result.data as T }

  return { ...state, retry }
}
