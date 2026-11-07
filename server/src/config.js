const env = process.env
const isProd = env.NODE_ENV === 'production'

function required(name) {
  const value = env[name]
  if (!value) throw new Error(`Environment variable ${name} wajib diisi (lihat .env.example)`)
  return value
}

const sessionSecret = required('SESSION_SECRET')
if (isProd && (sessionSecret.length < 32 || /^ganti-dengan/i.test(sessionSecret))) {
  throw new Error('SESSION_SECRET pada production harus acak, minimal 32 karakter (jangan pakai nilai contoh dari .env.example)')
}

const sameSite = (env.COOKIE_SAMESITE || 'lax').toLowerCase()
if (!['lax', 'strict', 'none'].includes(sameSite)) {
  throw new Error('COOKIE_SAMESITE harus lax, strict, atau none')
}

// Production wajib menyebut domain frontend secara eksplisit. Tanpa ini, login dari domain asli
// ditolak "Origin tidak diizinkan" karena nilai bawaan hanya localhost.
const clientOrigins = (env.CLIENT_ORIGIN || (isProd ? '' : 'http://localhost:5173')).split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean)
if (isProd) {
  if (clientOrigins.length === 0) throw new Error('CLIENT_ORIGIN wajib diisi pada production, mis. https://dashboard.andracopotan.com')
  const bad = clientOrigins.find((o) => !/^https:\/\/[^/]+$/.test(o))
  if (bad) throw new Error(`CLIENT_ORIGIN "${bad}" tidak valid: pakai https://domain tanpa path dan tanpa garis miring di akhir`)
}

// Hampir semua hosting (Railway, Render, Fly, nginx, Cloudflare) ada di depan Node sebagai reverse proxy.
// Tanpa trust proxy, cookie "Secure" tidak pernah dikirim sehingga login berhasil lalu langsung terlempar lagi.
// Karena itu pada production nilai bawaannya true; set TRUST_PROXY=false hanya jika Node langsung menghadap internet.
const trustProxy = env.TRUST_PROXY ? env.TRUST_PROXY === 'true' : isProd

export const config = {
  env: env.NODE_ENV || 'development',
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT || 4000),
  databaseUrl: required('DATABASE_URL'),
  sessionSecret,
  sessionMaxAgeMs: Number(env.SESSION_MAX_AGE_HOURS || 12) * 3600 * 1000,
  clientOrigins,
  trustProxy,
  cookieSameSite: sameSite,
  // Sajikan hasil build frontend (dist/) dari server ini => satu domain, cookie login aman dan sederhana.
  serveClient: env.SERVE_CLIENT ? env.SERVE_CLIENT === 'true' : isProd,
  maxCashierDiscountPercent: Number(env.MAX_CASHIER_DISCOUNT_PERCENT ?? 10),
  lowStockThreshold: Number(env.LOW_STOCK_THRESHOLD ?? 6),
  tzOffsetMinutes: Number(env.TZ_OFFSET_MINUTES ?? 480),
}

// Atribut cookie session; dipakai juga saat menghapus cookie agar browser benar-benar menghapusnya.
export const sessionCookieOptions = {
  httpOnly: true,
  secure: isProd || sameSite === 'none',
  sameSite,
}
