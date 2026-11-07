import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, setCsrfToken, setUnauthorizedHandler } from '../api/client'
import { AuthContext } from './authState'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Pulihkan session saat halaman dimuat/refresh: sumber kebenaran adalah server.
  useEffect(() => {
    let active = true
    api.me()
      .then((data) => { if (active) { setCsrfToken(data.csrfToken); setUser(data.user) } })
      .catch(() => { if (active) setUser(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  // Bila server menolak karena session berakhir, kembalikan ke login.
  useEffect(() => {
    setUnauthorizedHandler(() => { setCsrfToken(null); setUser(null) })
    return () => setUnauthorizedHandler(null)
  }, [])

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password)
    setCsrfToken(data.csrfToken)
    setUser(data.user)
    return data
  }, [])

  const logout = useCallback(async () => {
    try { await api.logout() } finally { setCsrfToken(null); setUser(null) }
  }, [])

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
