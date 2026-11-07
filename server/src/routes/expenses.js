import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { ownerOnly } from '../middleware/auth.js'
import { audit } from '../utils/audit.js'
import { startOfDay, todayYmd } from '../utils/dates.js'
import { wrap } from '../utils/errors.js'
import { parse } from '../utils/validate.js'

const router = Router()
router.use(ownerOnly)

const schema = z.object({
  category: z.string().trim().min(1, 'Kategori wajib diisi.').max(60).default('Operasional'),
  description: z.string().trim().min(1, 'Keterangan wajib diisi.').max(200),
  amount: z.number({ error: 'Nominal harus berupa angka.' }).int('Nominal harus bilangan bulat (rupiah).').min(1, 'Nominal harus lebih dari 0.').max(1_000_000_000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD.').optional(),
})

export const expenseOut = (e) => ({
  id: e.id, category: e.category, description: e.description, amount: e.amount,
  date: e.date.toISOString().slice(0, 10), createdAt: e.createdAt,
})

router.get('/', wrap(async (req, res) => {
  const { from, to } = req.query
  const where = {}
  if (from || to) {
    where.date = {}
    if (from) { startOfDay(String(from)); where.date.gte = new Date(`${from}T00:00:00Z`) }
    if (to) { startOfDay(String(to)); where.date.lte = new Date(`${to}T00:00:00Z`) }
  }
  const expenses = await prisma.expense.findMany({ where, orderBy: [{ date: 'desc' }, { id: 'desc' }], take: 500 })
  res.json({ expenses: expenses.map(expenseOut) })
}))

router.post('/', wrap(async (req, res) => {
  const data = parse(schema, req.body)
  const ymd = data.date ?? todayYmd()
  startOfDay(ymd) // validasi tanggal nyata
  const expense = await prisma.expense.create({
    data: { category: data.category, description: data.description, amount: data.amount, date: new Date(`${ymd}T00:00:00Z`), createdById: req.user.id },
  })
  await audit(prisma, req.user.id, 'CREATE_EXPENSE', 'expense', expense.id, { amount: expense.amount })
  res.status(201).json({ expense: expenseOut(expense) })
}))

export default router
