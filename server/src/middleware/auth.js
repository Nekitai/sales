import { prisma } from '../db.js'
import { sessionCookieOptions } from '../config.js'
import { forbidden, unauthorized, wrap } from '../utils/errors.js'

export const publicUser = (u) => ({ id: u.id, name: u.name, username: u.username, role: u.role, isActive: u.isActive })

// Muat user dari session pada setiap request: akun yang dinonaktifkan langsung kehilangan akses.
export const loadUser = wrap(async (req, res, next) => {
  const id = req.session?.userId
  if (id) {
    const user = await prisma.user.findUnique({ where: { id } })
    if (user && user.isActive) {
      req.user = user
    } else {
      await new Promise((resolve) => req.session.destroy(resolve))
      res.clearCookie('dp.sid', sessionCookieOptions)
    }
  }
  next()
})

export function requireAuth(req, res, next) {
  if (!req.user) return next(unauthorized())
  next()
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(unauthorized())
  if (!roles.includes(req.user.role)) return next(forbidden())
  next()
}

export const ownerOnly = requireRole('OWNER')
export const kasirOnly = requireRole('KASIR')
