import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/useAuth'
import ProtectedRoute from './auth/ProtectedRoute'
import { homeFor } from './auth/roles'
import DashboardLayout from './layouts/DashboardLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Sales from './pages/Sales'
import Inventory from './pages/Inventory'
import Expenses from './pages/Expenses'
import Returns from './pages/Returns'
import Reports from './pages/Reports'
import Cashflow from './pages/Cashflow'
import Settings from './pages/Settings'

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute role="OWNER" />}>
          <Route element={<DashboardLayout />}>
            <Route path="/owner/dashboard" element={<Dashboard />} />
            <Route path="/owner/produk" element={<Products />} />
            <Route path="/owner/penjualan" element={<Sales mode="owner" />} />
            <Route path="/owner/persediaan" element={<Inventory />} />
            <Route path="/owner/pengeluaran" element={<Expenses />} />
            <Route path="/owner/retur" element={<Returns />} />
            <Route path="/owner/laporan" element={<Reports />} />
            <Route path="/owner/arus-kas" element={<Cashflow />} />
            <Route path="/owner/pengaturan" element={<Settings />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute role="KASIR" />}>
          <Route element={<DashboardLayout />}>
            <Route path="/kasir/penjualan" element={<Sales mode="kasir" />} />
          </Route>
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
