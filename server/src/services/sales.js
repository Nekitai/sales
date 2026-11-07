import { config } from '../config.js'
import { prisma } from '../db.js'
import { todayYmd } from '../utils/dates.js'
import { badRequest, conflict } from '../utils/errors.js'

// Bagi diskon transaksi ke tiap baris secara proporsional (bilangan bulat, total persis sama dengan diskon).
export function allocateDiscount(grossLines, discount) {
  const subtotal = grossLines.reduce((s, g) => s + g, 0)
  if (discount === 0 || subtotal === 0) return grossLines.map(() => 0)
  const alloc = grossLines.map((g) => Math.floor((discount * g) / subtotal))
  let rest = discount - alloc.reduce((s, a) => s + a, 0)
  for (let i = 0; rest > 0 && i < alloc.length * 2; i++) {
    const j = i % alloc.length
    if (alloc[j] < grossLines[j]) { alloc[j]++; rest-- }
  }
  return alloc
}

export async function createSale(cashierId, input) {
  // Gabungkan baris produk yang sama; urutkan by id agar lock konsisten (hindari deadlock).
  const merged = new Map()
  for (const it of input.items) merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.qty)
  const lines = [...merged.entries()].map(([productId, qty]) => ({ productId, qty })).sort((a, b) => a.productId - b.productId)

  return prisma.$transaction(async (tx) => {
    const priced = []
    for (const line of lines) {
      // Kurangi stok secara atomik; baris tidak terpengaruh bila stok kurang / produk nonaktif.
      // Harga & HPP diambil dari baris yang sama saat di-lock => snapshot konsisten.
      const rows = await tx.$queryRaw`
        UPDATE products SET stock = stock - ${line.qty}, updated_at = NOW()
        WHERE id = ${line.productId} AND is_active = true AND stock >= ${line.qty}
        RETURNING id, name, price, cost`
      if (rows.length === 0) {
        const p = await tx.product.findUnique({ where: { id: line.productId } })
        if (!p) throw badRequest(`Produk #${line.productId} tidak ditemukan.`)
        if (!p.isActive) throw badRequest(`Produk "${p.name}" tidak aktif.`)
        throw conflict(`Stok "${p.name}" tidak mencukupi (tersedia ${p.stock}, diminta ${line.qty}).`)
      }
      priced.push({ ...rows[0], qty: line.qty })
    }

    const gross = priced.map((p) => p.price * p.qty)
    const subtotal = gross.reduce((s, g) => s + g, 0)
    const discount = input.discount
    const maxDiscount = Math.floor((subtotal * config.maxCashierDiscountPercent) / 100)
    if (discount > maxDiscount) {
      throw badRequest(`Diskon maksimal ${config.maxCashierDiscountPercent}% dari subtotal (Rp ${maxDiscount.toLocaleString('id-ID')}).`)
    }
    const total = subtotal - discount
    const amountPaid = input.paymentMethod === 'CASH' ? (input.amountPaid ?? total) : total
    if (amountPaid < total) throw badRequest('Uang yang dibayarkan kurang dari total.')

    const lineDiscounts = allocateDiscount(gross, discount)
    const placeholder = `TMP-${crypto.randomUUID()}`
    const sale = await tx.sale.create({
      data: {
        invoiceNo: placeholder, cashierId, subtotal, discount, total,
        paymentMethod: input.paymentMethod, amountPaid,
        items: {
          create: priced.map((p, i) => ({
            productId: p.id, productName: p.name, qty: p.qty,
            unitPrice: p.price, unitCost: p.cost,
            lineDiscount: lineDiscounts[i], lineTotal: gross[i] - lineDiscounts[i],
          })),
        },
      },
    })
    const invoiceNo = `INV-${todayYmd().replaceAll('-', '')}-${String(sale.id).padStart(6, '0')}`
    return tx.sale.update({
      where: { id: sale.id }, data: { invoiceNo },
      include: { items: true, cashier: { select: { id: true, name: true } } },
    })
  })
}

// Bentuk respons: kasir tidak pernah menerima HPP.
export function saleOut(sale, role) {
  return {
    id: sale.id, invoiceNo: sale.invoiceNo, createdAt: sale.createdAt, status: sale.status,
    cashier: sale.cashier ? { id: sale.cashier.id, name: sale.cashier.name } : undefined,
    subtotal: sale.subtotal, discount: sale.discount, total: sale.total,
    paymentMethod: sale.paymentMethod, amountPaid: sale.amountPaid, change: sale.amountPaid - sale.total,
    items: sale.items.map((i) => ({
      id: i.id, productId: i.productId, productName: i.productName, qty: i.qty,
      unitPrice: i.unitPrice, lineDiscount: i.lineDiscount, lineTotal: i.lineTotal,
      ...(role === 'OWNER' ? { unitCost: i.unitCost } : {}),
    })),
  }
}
