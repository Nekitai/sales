import { Router } from 'express'
import { prisma } from '../db.js'
import { ownerOnly } from '../middleware/auth.js'
import { cashflow, lowStock, summary } from '../services/reports.js'
import { saleOut } from '../services/sales.js'
import { parsePeriod } from '../utils/dates.js'
import { wrap } from '../utils/errors.js'
import { config } from '../config.js'

const router = Router()
router.use(ownerOnly)

router.get('/summary', wrap(async (req, res) => res.json(await summary(parsePeriod(req.query)))))
router.get('/cashflow', wrap(async (req, res) => res.json(await cashflow(parsePeriod(req.query)))))

// Baris penjualan per item (untuk unduh CSV di frontend).
router.get('/sales', wrap(async (req, res) => {
  const p = parsePeriod(req.query)
  const sales = await prisma.sale.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: p.gte, lt: p.lt } }, orderBy: { createdAt: 'asc' },
    include: { items: true, cashier: { select: { id: true, name: true } } },
  })
  res.json({ period: { from: p.from, to: p.to }, sales: sales.map((s) => saleOut(s, 'OWNER')) })
}))

router.get('/dashboard', wrap(async (req, res) => {
  const p = parsePeriod(req.query)
  const [sum, recent, low, inv] = await Promise.all([
    summary(p),
    prisma.sale.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { items: true, cashier: { select: { id: true, name: true } } } }),
    lowStock(),
    prisma.$queryRaw`SELECT COALESCE(SUM(stock * cost),0)::bigint AS value FROM products WHERE is_active = true`,
  ])
  res.json({
    summary: sum,
    recentSales: recent.map((s) => saleOut(s, 'OWNER')),
    lowStock: low, lowStockThreshold: config.lowStockThreshold,
    inventoryValue: Number(inv[0].value),
  })
}))

export default router
