import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { homeFor } from '../auth/roles'
import { Notice } from '../components/Feedback'

// Setelah login, kembali ke halaman yang dituju sebelumnya, tetapi hanya bila sesuai role (owner/kasir).
function destinationAfterLogin(from, user, fallback) {
  const prefix = user.role === 'OWNER' ? '/owner/' : '/kasir/'
  return typeof from === 'string' && from.startsWith(prefix) ? from : fallback
}

function Login() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Dipakai juga di sini: begitu user terisi, komponen ini langsung render ulang dan mengalihkan lebih dulu daripada navigate() di submit.
  if (!loading && user) return <Navigate to={destinationAfterLogin(location.state?.from, user, homeFor(user.role))} replace />

  async function submit(event) {
    event.preventDefault()
    if (submitting) return
    setError('')
    if (!username.trim() || !password) {
      setError('Username dan password wajib diisi.')
      return
    }
    setSubmitting(true)
    try {
      const data = await login(username.trim(), password)
      navigate(destinationAfterLogin(location.state?.from, data.user, data.redirectTo), { replace: true })
    } catch (err) {
      setError(err.message)
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-aspal-950 p-5">
      <div className="grid w-full max-w-4xl items-center gap-8 md:grid-cols-[1fr_22rem]">
        <img
          src="/logo.webp"
          alt="Andra Copotan Makassar — jual beli copotan mobil ori"
          width="600"
          height="600"
          className="mx-auto w-44 md:w-full md:max-w-md"
        />

        <form onSubmit={submit} className="rounded-lg border-t-4 border-t-lemon-400 bg-white p-6 shadow-2xl" noValidate>
          <h1 className="mb-1 text-3xl text-aspal-950">Masuk</h1>
          <p className="mb-5 text-sm text-aspal-600">Khusus owner dan kasir Andra Copotan.</p>
          <Notice>{error}</Notice>

          <label className="mb-4 block text-sm font-medium text-aspal-800">
            Username
            <input
              className="mt-1 w-full rounded-md border p-2.5 font-normal"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
          </label>

          <label className="mb-2 block text-sm font-medium text-aspal-800">
            Password
            <input
              type={showPassword ? 'text' : 'password'}
              className="mt-1 w-full rounded-md border p-2.5 font-normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          <label className="mb-5 flex items-center gap-2 text-sm text-aspal-700">
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="h-4 w-4 accent-racing-600" />
            Tampilkan password
          </label>

          <button disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
