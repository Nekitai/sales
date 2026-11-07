export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}
export const badRequest = (m, d) => new HttpError(400, m, d)
export const unauthorized = (m = 'Silakan login terlebih dahulu.') => new HttpError(401, m)
export const forbidden = (m = 'Anda tidak memiliki izin untuk aksi ini.') => new HttpError(403, m)
export const notFound = (m = 'Data tidak ditemukan.') => new HttpError(404, m)
export const conflict = (m, d) => new HttpError(409, m, d)

// Bungkus handler async agar error masuk ke error middleware.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
