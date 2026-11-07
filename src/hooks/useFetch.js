import { useCallback, useEffect, useRef, useState } from 'react'

// Muat data dari API: { data, loading, error, reload }. Data dimuat ulang saat `deps` berubah.
export function useFetch(fn, deps = []) {
  const fnRef = useRef(fn)
  const [state, setState] = useState({ data: null, loading: true, error: null })

  useEffect(() => { fnRef.current = fn })

  const load = useCallback(
    () => fnRef.current().then((data) => ({ data, error: null })).catch((error) => ({ data: null, error })),
    [],
  )

  useEffect(() => {
    let active = true
    load().then((result) => active && setState({ ...result, loading: false }))
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...deps])

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    setState({ ...(await load()), loading: false })
  }, [load])

  return { ...state, reload }
}
