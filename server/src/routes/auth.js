import { Router } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sessionCookieOptions } from '../config.js'
import { publicUser, requireAuth } from '../middleware/auth.js'
import { newCsrfToken } from '../middleware/security.js'
import { hashPassword, verifyPassword, DUMMY_HASH } from '../services/passwords.js'
import { destroyUserSessions } from '../services/sessions.js'
import { audit } from '../utils/audit.js'
import { badRequest, unauthorized, wrap } from '../utils/errors.js'
import { parse } from '../utils/validate.js'

export const homeFor = (role) => (role === 'OWNER' ? '/owner/dashboard' : '/kasir/penjualan')

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, 'Username wajib diisi.').max(64),
  password: z.string().min(1, 'Password wajib diisi.').max(200),
})

export const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter.')
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Password harus mengandung huruf dan angka.')

export function authRouter({ loginLimitMax = 10 } = {}) {
  const router = Router()

  const tooMany = (req, res) =>
    res.status(429).json({ error: { message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' } })
  const base = { windowMs: 15 * 60 * 1000, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, handler: tooMany }

  // Batas per IP + username: penyerang yang menebak password satu akun terkunci,
  // tetapi pemilik akun dari jaringan lain tidak ikut terkunci.
  const loginLimiter = rateLimit({
    ...base,
    limit: loginLimitMax,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.username ?? '').trim().toLowerCase().slice(0, 64)}`,
  })
  // Batas longgar per IP untuk menahan penyemprotan banyak username dari satu sumber.
  const ipLimiter = rateLimit({ ...base, limit: loginLimitMax * 5, keyGenerator: (req) => ipKeyGenerator(req.ip) })

  router.post(
    '/login',
    ipLimiter,
    loginLimiter,
    wrap(async (req, res) => {
      const { username, password } = parse(loginSchema, req.body)
      const user = await prisma.user.findUnique({ where: { username } })
      // Selalu jalankan bcrypt agar waktu respons seragam.
      const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)
      if (!user || !ok || !user.isActive) throw unauthorized('Username atau password salah.')

      // Regenerasi session untuk mencegah session fixation.
      await new Promise((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())))
      req.session.userId = user.id
      req.session.csrfToken = newCsrfToken()
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      await audit(prisma, user.id, 'LOGIN', 'user', user.id)
      await new Promise((resolve, reject) => req.session.save((e) => (e ? reject(e) : resolve())))
      res.json({ user: publicUser(user), csrfToken: req.session.csrfToken, redirectTo: homeFor(user.role) })
    }),
  )

  router.post(
    '/logout',
    wrap(async (req, res) => {
      if (req.session) await new Promise((resolve) => req.session.destroy(resolve))
      res.clearCookie('dp.sid', sessionCookieOptions)
      res.json({ ok: true })
    }),
  )

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user), csrfToken: req.session.csrfToken, redirectTo: homeFor(req.user.role) })
  })

  router.post(
    '/change-password',
    requireAuth,
    wrap(async (req, res) => {
      const { currentPassword, newPassword } = parse(
        z.object({ currentPassword: z.string().min(1, 'Password saat ini wajib diisi.'), newPassword: passwordSchema }),
        req.body,
      )
      if (!(await verifyPassword(currentPassword, req.user.passwordHash))) throw badRequest('Password saat ini salah.')
      await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: await hashPassword(newPassword) } })
      await audit(prisma, req.user.id, 'CHANGE_PASSWORD', 'user', req.user.id)
      await destroyUserSessions(req.user.id, req.sessionID)
      res.json({ ok: true })
    }),
  )

  return router
}
