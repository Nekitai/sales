import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { kasirMenus, ownerMenus } from '../components/menus'
import { useAuth } from '../auth/useAuth'

function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const menus = user.role === 'OWNER' ? ownerMenus : kasirMenus

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen md:flex">
      <Sidebar menus={menus} />

      <main className="min-w-0 flex-1 p-5 sm:p-8">
        <header className="mb-8 flex items-center justify-end gap-3 border-b border-aspal-300 pb-4">
          <div className="flex items-center gap-3 text-sm text-aspal-700">
            <span>{user.name} · {user.role === 'OWNER' ? 'Owner' : 'Kasir'}</span>
            <button onClick={handleLogout} className="rounded-md border border-aspal-300 bg-white px-3 py-1.5 font-semibold text-aspal-950 hover:bg-aspal-200">
              Keluar
            </button>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  )
}

export default DashboardLayout
