import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { LoadingState } from '../components/Feedback'
import { homeFor } from './roles'

// Wajib login; bila `role` diberikan, hanya role itu yang boleh masuk (yang lain dialihkan ke beranda role-nya).
// Catatan: ini hanya kenyamanan UX. Penegakan izin yang sebenarnya ada di backend.
export default function ProtectedRoute({ role }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="p-8"><LoadingState /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} replace />
  return <Outlet />
}
