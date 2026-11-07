import crypto from 'node:crypto'
import { config } from '../config.js'
import { forbidden } from '../utils/errors.js'

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Content-Security-Policy', CSP)
  if (config.isProd) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  // Respons API tidak boleh disimpan cache; berkas statis frontend mengatur cache-nya sendiri.
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store')
  next()
}

// CORS manual: hanya origin yang terdaftar di CLIENT_ORIGIN, dengan credentials.
export function cors(req, res, next) {
  const origin = req.headers.origin
  if (origin && config.clientOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
}

// Tolak request mengubah data dari Origin yang tidak dikenal (melindungi juga endpoint login).
export function originCheck(req, res, next) {
  if (SAFE.has(req.method)) return next()
  const origin = req.headers.origin
  if (origin && !config.clientOrigins.includes(origin)) return next(forbidden('Origin tidak diizinkan.'))
  next()
}

// Synchronizer token: token acak disimpan di session, wajib dikirim via header X-CSRF-Token.
export function csrfProtect(req, res, next) {
  if (SAFE.has(req.method) || !req.session?.userId) return next()
  const sent = Buffer.from(String(req.headers['x-csrf-token'] || ''))
  const expected = Buffer.from(String(req.session.csrfToken || ''))
  if (sent.length === 0 || sent.length !== expected.length || !crypto.timingSafeEqual(sent, expected)) {
    return next(forbidden('Token CSRF tidak valid.'))
  }
  next()
}

export const newCsrfToken = () => crypto.randomBytes(32).toString('hex')
