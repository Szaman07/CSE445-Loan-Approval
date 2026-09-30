import { useEffect, useState } from 'react'

// Results are tied to their request key, so an old response never appears under new controls.
export function useRemote<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>()
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal).then(
      (data) => { if (!controller.signal.aborted) setState({ key, data }) },
      (error) => {
        if (!controller.signal.aborted) setState({ key, error: error instanceof Error ? error.message : 'Request failed.' })
      },
    )
    return () => controller.abort()
  }, [key, load])
  return state?.key === key ? { ...state, loading: false } : { loading: true, data: undefined, error: undefined }
}
