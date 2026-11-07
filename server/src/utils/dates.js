import { config } from '../config.js'
import { badRequest } from './errors.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// 'YYYY-MM-DD' (zona waktu toko) -> Date UTC awal hari tersebut.
export function startOfDay(ymd) {
  if (!DATE_RE.test(ymd)) throw badRequest('Format tanggal harus YYYY-MM-DD.')
  const [y, m, d] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  // Tolak tanggal yang "dibulatkan" otomatis (mis. 2026-13-45 atau 2026-02-31).
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) {
    throw badRequest('Tanggal tidak valid.')
  }
  return new Date(utc.getTime() - config.tzOffsetMinutes * 60000)
}

export function todayYmd(now = new Date()) {
  return new Date(now.getTime() + config.tzOffsetMinutes * 60000).toISOString().slice(0, 10)
}

export function addDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Rentang periode [gte, lt) dari query ?from=&to= (inklusif). Default: bulan berjalan.
export function parsePeriod(query) {
  const today = todayYmd()
  const from = query.from || `${today.slice(0, 8)}01`
  const to = query.to || today
  const gte = startOfDay(from)
  const lt = startOfDay(addDays(to, 1))
  if (gte >= lt) throw badRequest('Tanggal awal tidak boleh setelah tanggal akhir.')
  return { from, to, gte, lt }
}

// Date UTC -> 'YYYY-MM-DD' di zona waktu toko.
export function toStoreYmd(date) {
  return new Date(date.getTime() + config.tzOffsetMinutes * 60000).toISOString().slice(0, 10)
}
