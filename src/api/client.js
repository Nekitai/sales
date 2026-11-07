// Satu-satunya modul yang berbicara dengan backend. Session dikelola server lewat cookie HttpOnly;
// frontend hanya menyimpan token CSRF di memori (bukan di localStorage).
const BASE = import.meta.env.VITE_API_URL || '/api'

let csrfToken = null
export const setCsrfToken = (token) => { csrfToken = token }

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

let onUnauthorized = null
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

async function request(method, path, body) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method, headers, credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi Anda.')
  }

  let data = null
  try { data = await res.json() } catch { /* tanpa body */ }

  if (!res.ok) {
    const message = data?.error?.message || 'Terjadi kesalahan.'
    // Session berakhir di server: beri tahu AuthContext (kecuali saat login/me).
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized?.()
    throw new ApiError(res.status, message, data?.error?.details)
  }
  return data
}

const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null))
  return s.size ? `?${s}` : ''
}

export const api = {
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  logout: () => request('POST', '/auth/logout', {}),
  me: () => request('GET', '/auth/me'),
  changePassword: (currentPassword, newPassword) => request('POST', '/auth/change-password', { currentPassword, newPassword }),

  products: () => request('GET', '/products'),
  createProduct: (data) => request('POST', '/products', data),
  updateProduct: (id, data) => request('PATCH', `/products/${id}`, data),
  deactivateProduct: (id) => request('DELETE', `/products/${id}`),

  createSale: (data) => request('POST', '/sales', data),
  sales: (params) => request('GET', `/sales${qs(params)}`),
  sale: (id) => request('GET', `/sales/${id}`),

  expenses: (params) => request('GET', `/expenses${qs(params)}`),
  createExpense: (data) => request('POST', '/expenses', data),

  returns: () => request('GET', '/returns'),
  createReturn: (data) => request('POST', '/returns', data),

  dashboard: (params) => request('GET', `/reports/dashboard${qs(params)}`),
  summary: (params) => request('GET', `/reports/summary${qs(params)}`),
  cashflow: (params) => request('GET', `/reports/cashflow${qs(params)}`),
  salesReport: (params) => request('GET', `/reports/sales${qs(params)}`),

  users: () => request('GET', '/users'),
  createUser: (data) => request('POST', '/users', data),
  updateUser: (id, data) => request('PATCH', `/users/${id}`, data),
  resetPassword: (id, newPassword) => request('POST', `/users/${id}/reset-password`, { newPassword }),
}
