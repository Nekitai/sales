import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { ownerOnly } from '../middleware/auth.js'
import { audit } from '../utils/audit.js'
import { badRequest, conflict, notFound, wrap } from '../utils/errors.js'
import { parse } from '../utils/validate.js'

const router = Router()
router.use(ownerOnly)

const schema = z.object({
  saleId: z.number().int().positive(),
  reason: z.string().trim().max(200).default(''),
  items: z.array(z.object({
    saleItemId: z.number().int().positive(),
    qty: z.number().int('Kuantitas harus bilangan bulat.').min(1, 'Kuantitas retur minimal 1.'),
  })).min(1, 'Pilih minimal satu barang yang diretur.'),
})

export const returnOut = (r) => ({
  id: r.id, saleId: r.saleId, invoiceNo: r.sale?.invoiceNo, createdAt: r.createdAt, reason: r.reason,
  refundAmount: r.refundAmount, costRestored: r.costRestored,
  items: r.items.map((i) => ({
    id: i.id, saleItemId: i.saleItemId, qty: i.qty, refundAmount: i.refundAmount, costRestored: i.costRestored,
    productName: i.saleItem?.productName,
  })),
})

router.get('/', wrap(async (req, res) => {
  const returns = await prisma.return.findMany({
    orderBy: { createdAt: 'desc' }, take: 300,
    include: { sale: { select: { invoiceNo: true } }, items: { include: { saleItem: { select: { productName: true } } } } },
  })
  res.json({ returns: returns.map(returnOut) })
}))

// Refund = bagian proporsional dari nilai baris SETELAH diskon, kumulatif agar total retur penuh == lineTotal.
const cumulativeRefund = (lineTotal, qty, returnedQty) =>
  Math.floor((lineTotal * returnedQty) / qty)

router.post('/', wrap(async (req, res) => {
  const input = parse(schema, req.body)
  const created = await prisma.$transaction(async (tx) => {
    // Kunci baris transaksi agar dua retur bersamaan tidak melampaui kuantitas terjual.
    const locked = await tx.$queryRaw`SELECT id, status FROM sales WHERE id = ${input.saleId} FOR UPDATE`
    if (locked.length === 0) throw notFound('Transaksi tidak ditemukan.')
    if (locked[0].status !== 'COMPLETED') throw badRequest('Transaksi ini tidak dapat diretur.')

    const saleItems = await tx.saleItem.findMany({ where: { saleId: input.saleId }, include: { returnItems: true } })
    const byId = new Map(saleItems.map((i) => [i.id, i]))
    const merged = new Map()
    for (const it of input.items) merged.set(it.saleItemId, (merged.get(it.saleItemId) ?? 0) + it.qty)

    let refundAmount = 0
    let costRestored = 0
    const rows = []
    for (const [saleItemId, qty] of merged) {
      const item = byId.get(saleItemId)
      if (!item) throw badRequest('Barang tidak termasuk dalam transaksi ini.')
      const already = item.returnItems.reduce((s, r) => s + r.qty, 0)
      if (qty > item.qty - already) throw conflict(`Jumlah retur "${item.productName}" melebihi sisa (${item.qty - already}).`)
      const refund = cumulativeRefund(item.lineTotal, item.qty, already + qty) - cumulativeRefund(item.lineTotal, item.qty, already)
      const cost = item.unitCost * qty
      refundAmount += refund
      costRestored += cost
      rows.push({ saleItemId, qty, refundAmount: refund, costRestored: cost, productId: item.productId })
    }

    const ret = await tx.return.create({
      data: {
        saleId: input.saleId, createdById: req.user.id, reason: input.reason, refundAmount, costRestored,
        items: { create: rows.map((r) => ({ saleItemId: r.saleItemId, qty: r.qty, refundAmount: r.refundAmount, costRestored: r.costRestored })) },
      },
      include: { sale: { select: { invoiceNo: true } }, items: { include: { saleItem: { select: { productName: true } } } } },
    })
    for (const r of rows) {
      await tx.product.update({ where: { id: r.productId }, data: { stock: { increment: r.qty } } })
    }
    await audit(tx, req.user.id, 'CREATE_RETURN', 'return', ret.id, { saleId: input.saleId, refundAmount })
    return ret
  })
  res.status(201).json({ return: returnOut(created) })
}))

export default router
