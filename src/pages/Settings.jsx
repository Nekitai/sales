import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { ErrorState, LoadingState, Notice } from '../components/Feedback'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'

const emptyUser = { name: '', username: '', password: '' }

function Settings() {
  const { data, loading, error, reload } = useFetch(() => api.users(), [])
  const [form, setForm] = useState(emptyUser)
  const [msg, setMsg] = useState({ type: 'error', text: '' })
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' })
  const [pwMsg, setPwMsg] = useState({ type: 'error', text: '' })

  const ok = (text) => setMsg({ type: 'success', text })
  const fail = (err) => setMsg({ type: 'error', text: err.message })

  async function createUser(event) {
    event.preventDefault()
    setMsg({ type: 'error', text: '' })
    try {
      await api.createUser({ ...form, username: form.username.trim().toLowerCase() })
      setForm(emptyUser)
      ok('Akun kasir dibuat.')
      await reload()
    } catch (err) { fail(err) }
  }

  async function toggle(user) {
    const action = user.isActive ? 'Nonaktifkan' : 'Aktifkan'
    if (!window.confirm(`${action} akun ${user.username}?`)) return
    try {
      await api.updateUser(user.id, { isActive: !user.isActive })
      ok(`Akun ${user.username} ${user.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`)
      await reload()
    } catch (err) { fail(err) }
  }

  async function reset(user) {
    const newPassword = window.prompt(`Password baru untuk ${user.username} (minimal 8 karakter, huruf dan angka):`)
    if (!newPassword) return
    try {
      await api.resetPassword(user.id, newPassword)
      ok(`Password ${user.username} direset. Semua sesi login akun tersebut dihentikan.`)
    } catch (err) { fail(err) }
  }

  async function changePassword(event) {
    event.preventDefault()
    setPwMsg({ type: 'error', text: '' })
    try {
      await api.changePassword(pw.currentPassword, pw.newPassword)
      setPw({ currentPassword: '', newPassword: '' })
      setPwMsg({ type: 'success', text: 'Password berhasil diganti.' })
    } catch (err) { setPwMsg({ type: 'error', text: err.message }) }
  }

  return (
    <>
      <PageHeader title="Pengaturan" description="Kelola akun kasir dan keamanan akun Anda." />

      <h3 className="mb-3 font-semibold">Akun kasir</h3>
      <Notice type={msg.type}>{msg.text}</Notice>

      <form onSubmit={createUser} className="mb-6 grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-4">
        <input className="rounded-lg border p-2.5" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="rounded-lg border p-2.5" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" required />
        <input className="rounded-lg border p-2.5" type="password" placeholder="Password awal" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" required />
        <button className="btn-primary">Buat Akun Kasir</button>
      </form>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}

      {data && (
        <section className="mb-8 overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[550px] text-left text-sm">
            <thead className="bg-aspal-100">
              <tr><th className="p-4">Nama</th><th className="p-4">Username</th><th className="p-4">Status</th><th className="p-4">Aksi</th></tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-4 font-medium">{u.name}</td>
                  <td className="p-4">{u.username}</td>
                  <td className="p-4">
                    <span className={u.isActive ? 'text-emerald-600' : 'text-aspal-500'}>{u.isActive ? 'Aktif' : 'Nonaktif'}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-3">
                      <button onClick={() => toggle(u)} className={u.isActive ? 'text-action text-racing-700' : 'text-action text-emerald-700'}>
                        {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button onClick={() => reset(u)} className="text-action text-aspal-950">Reset password</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data.users.length && <tr><td colSpan="4" className="p-6 text-center text-aspal-600">Belum ada akun kasir.</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      <h3 className="mb-3 font-semibold">Ganti password saya</h3>
      <Notice type={pwMsg.type}>{pwMsg.text}</Notice>
      <form onSubmit={changePassword} className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-3">
        <input className="rounded-lg border p-2.5" type="password" placeholder="Password saat ini" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" required />
        <input className="rounded-lg border p-2.5" type="password" placeholder="Password baru" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" required />
        <button className="btn-primary">Ganti Password</button>
      </form>
    </>
  )
}

export default Settings
