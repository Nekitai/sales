import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { ownerOnly, publicUser } from '../middleware/auth.js'
import { hashPassword } from '../services/passwords.js'
import { destroyUserSessions } from '../services/sessions.js'
import { audit } from '../utils/audit.js'
import { conflict, notFound, wrap } from '../utils/errors.js'
import { parse } from '../utils/validate.js'
import { passwordSchema } from './auth.js'

const router = Router()
router.use(ownerOnly)

const userOut = (u) => ({ ...publicUser(u), createdAt: u.createdAt, lastLoginAt: u.lastLoginAt })

const createSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.').max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/, 'Username 3-32 karakter: huruf kecil, angka, titik, strip, underscore.'),
  password: passwordSchema,
})
const patchSchema = z.object({ name: z.string().trim().min(1).max(80).optional(), isActive: z.boolean().optional() })

async function findKasir(id) {
  const user = await prisma.user.findUnique({ where: { id: Number(id) || 0 } })
  if (!user || user.role !== 'KASIR') throw notFound('Akun kasir tidak ditemukan.')
  return user
}

router.get('/', wrap(async (req, res) => {
  const users = await prisma.user.findMany({ where: { role: 'KASIR' }, orderBy: { createdAt: 'desc' } })
  res.json({ users: users.map(userOut) })
}))

router.post('/', wrap(async (req, res) => {
  const data = parse(createSchema, req.body)
  if (await prisma.user.findUnique({ where: { username: data.username } })) throw conflict('Username sudah dipakai.')
  const user = await prisma.user.create({
    data: { name: data.name, username: data.username, passwordHash: await hashPassword(data.password), role: 'KASIR' },
  })
  await audit(prisma, req.user.id, 'CREATE_KASIR', 'user', user.id, { username: user.username })
  res.status(201).json({ user: userOut(user) })
}))

router.patch('/:id', wrap(async (req, res) => {
  const target = await findKasir(req.params.id)
  const data = parse(patchSchema, req.body)
  const user = await prisma.user.update({ where: { id: target.id }, data })
  if (data.isActive === false) await destroyUserSessions(target.id)
  await audit(prisma, req.user.id, 'UPDATE_KASIR', 'user', target.id, data)
  res.json({ user: userOut(user) })
}))

router.post('/:id/reset-password', wrap(async (req, res) => {
  const target = await findKasir(req.params.id)
  const { newPassword } = parse(z.object({ newPassword: passwordSchema }), req.body)
  await prisma.user.update({ where: { id: target.id }, data: { passwordHash: await hashPassword(newPassword) } })
  await destroyUserSessions(target.id)
  await audit(prisma, req.user.id, 'RESET_PASSWORD', 'user', target.id)
  res.json({ ok: true })
}))

export default router
