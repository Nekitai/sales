import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { kasirOnly } from '../middleware/auth.js'
import { createSale, saleOut } from '../services/sales.js'
import { audit } from '../utils/audit.js'
import { startOfDay, addDays } from '../utils/dates.js'
import { forbidden, notFound, wrap } from '../utils/errors.js'
import { parse } from '../utils/validate.js'

const router = Router()

const createSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    qty: z.number({ error: 'Kuantitas harus berupa angka.' }).int('Kuantitas harus bilangan bulat.').min(1, 'Kuantitas minimal 1.').max(10000),
  })).min(1, 'Keranjang masih kosong.').max(50, 'Maksimal 50 baris produk per transaksi.'),
  discount: z.number().int('Diskon harus bilangan bulat (rupiah).').min(0, 'Diskon tidak boleh negatif.').default(0),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'QRIS'], { error: 'Metode pembayaran tidak valid.' }),
  amountPaid: z.number().int().min(0).optional(),
})

// Hanya KASIR yang membuat transaksi. Total, harga, dan HPP dihitung server.
router.post('/', kasirOnly, wrap(async (req, res) => {
  const input = parse(createSchema, req.body)
  const sale = await createSale(req.user.id, input)
  await audit(prisma, req.user.id, 'CREATE_SALE', 'sale', sale.id, { invoiceNo: sale.invoiceNo, total: sale.total })
  res.status(201).json({ sale: saleOut(sale, 'KASIR') })
}))

// Owner: semua kasir. Kasir: hanya transaksi miliknya sendiri.
router.get('/', wrap(async (req, res) => {
  const { from, to, cashierId } = req.query
  const limit = Math.min(Number(req.query.limit) || 200, 500)
  const where = {}
  if (req.user.role === 'KASIR') where.cashierId = req.user.id
  else if (cashierId) where.cashierId = Number(cashierId) || 0
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = startOfDay(String(from))
    if (to) where.createdAt.lt = startOfDay(addDays(String(to), 1))
  }
  const sales = await prisma.sale.findMany({
    where, orderBy: { createdAt: 'desc' }, take: limit,
    include: { items: true, cashier: { select: { id: true, name: true } } },
  })
  res.json({ sales: sales.map((s) => saleOut(s, req.user.role)) })
}))

router.get('/:id', wrap(async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: Number(req.params.id) || 0 },
    include: { items: true, cashier: { select: { id: true, name: true } } },
  })
  if (!sale) throw notFound('Transaksi tidak ditemukan.')
  if (req.user.role === 'KASIR' && sale.cashierId !== req.user.id) throw forbidden()
  const out = saleOut(sale, req.user.role)
  if (req.user.role === 'OWNER') {
    const returned = await prisma.returnItem.groupBy({
      by: ['saleItemId'], where: { saleItem: { saleId: sale.id } }, _sum: { qty: true },
    })
    const map = new Map(returned.map((r) => [r.saleItemId, r._sum.qty ?? 0]))
    out.items = out.items.map((i) => ({ ...i, returnedQty: map.get(i.id) ?? 0 }))
  }
  res.json({ sale: out })
}))

export default router
