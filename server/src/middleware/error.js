import { HttpError } from '../utils/errors.js'
import { config } from '../config.js'

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: 'Endpoint tidak ditemukan.' } })
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } })
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Body JSON tidak valid.' } })
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'Body terlalu besar.' } })
  }
  // Prisma: unique constraint
  if (err?.code === 'P2002') {
    return res.status(409).json({ error: { message: 'Data sudah ada (duplikat).' } })
  }
  // Postgres: CHECK constraint (mis. stok negatif) / serialization failure
  if (err?.cause?.originalCode === '23514' || err?.code === '23514') {
    return res.status(409).json({ error: { message: 'Perubahan ditolak oleh aturan data (mis. stok tidak cukup).' } })
  }
  if (!config.isTest) console.error(err)
  res.status(500).json({ error: { message: 'Terjadi kesalahan pada server.' } })
}
