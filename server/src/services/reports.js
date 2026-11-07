import { config } from '../config.js'
import { prisma } from '../db.js'
import { toStoreYmd } from '../utils/dates.js'

const n = (v) => Number(v ?? 0)

// Ringkasan keuangan satu periode. Semua angka integer rupiah.
//  netSales     = total penjualan setelah diskon - nilai retur (retur dicatat pada tanggal retur)
//  hpp          = HPP snapshot barang terjual - HPP barang yang diretur (stok kembali)
//  grossProfit  = netSales - hpp
//  operatingProfit = grossProfit - pengeluaran
// Bila ada item terjual dengan HPP <= 0 (data tidak valid), seluruh angka laba = null.
export async function summary({ from, to, gte, lt }) {
  const [sales] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count, COALESCE(SUM(subtotal),0)::bigint AS gross, COALESCE(SUM(discount),0)::bigint AS discount, COALESCE(SUM(total),0)::bigint AS total
    FROM sales WHERE status = 'COMPLETED' AND created_at >= ${gte} AND created_at < ${lt}`
  const [cost] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(si.unit_cost * si.qty),0)::bigint AS hpp,
           COUNT(*) FILTER (WHERE si.unit_cost <= 0)::int AS invalid
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE s.status = 'COMPLETED' AND s.created_at >= ${gte} AND s.created_at < ${lt}`
  const [ret] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(refund_amount),0)::bigint AS refund, COALESCE(SUM(cost_restored),0)::bigint AS cost
    FROM returns WHERE created_at >= ${gte} AND created_at < ${lt}`
  const [exp] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(amount),0)::bigint AS total FROM expenses
    WHERE date >= ${new Date(`${from}T00:00:00Z`)} AND date <= ${new Date(`${to}T00:00:00Z`)}`

  const grossSales = n(sales.gross), discounts = n(sales.discount), salesTotal = n(sales.total)
  const returnsTotal = n(ret.refund)
  const netSales = salesTotal - returnsTotal
  const hpp = n(cost.hpp) - n(ret.cost)
  const expenses = n(exp.total)
  const invalidItems = cost.invalid
  const warnings = []
  if (invalidItems > 0) warnings.push(`${invalidItems} item terjual memiliki HPP tidak valid (Rp 0). Laba tidak ditampilkan sampai harga modal diperbaiki.`)
  const valid = invalidItems === 0
  const grossProfit = valid ? netSales - hpp : null
  return {
    period: { from, to },
    transactionCount: sales.count,
    grossSales, discounts, salesTotal, returns: returnsTotal, netSales, hpp, expenses,
    grossProfit,
    operatingProfit: valid ? grossProfit - expenses : null,
    dataValid: valid, warnings,
  }
}

// Arus kas = uang yang benar-benar masuk/keluar. Pembelian stok tidak dicatat di aplikasi ini sehingga tidak termasuk.
export async function cashflow({ from, to, gte, lt }) {
  const [sales, expenses, returns] = await Promise.all([
    prisma.sale.findMany({ where: { status: 'COMPLETED', createdAt: { gte, lt } }, select: { id: true, invoiceNo: true, createdAt: true, total: true, paymentMethod: true } }),
    prisma.expense.findMany({ where: { date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } } }),
    prisma.return.findMany({ where: { createdAt: { gte, lt } }, include: { sale: { select: { invoiceNo: true } } } }),
  ])
  const rows = [
    ...sales.map((s) => ({ id: `sale-${s.id}`, date: toStoreYmd(s.createdAt), at: s.createdAt, description: `Penjualan ${s.invoiceNo} (${s.paymentMethod})`, type: 'MASUK', amount: s.total })),
    ...expenses.map((e) => ({ id: `expense-${e.id}`, date: e.date.toISOString().slice(0, 10), at: e.createdAt, description: `${e.category}: ${e.description}`, type: 'KELUAR', amount: e.amount })),
    ...returns.filter((r) => r.refundAmount > 0).map((r) => ({ id: `return-${r.id}`, date: toStoreYmd(r.createdAt), at: r.createdAt, description: `Retur ${r.sale.invoiceNo}`, type: 'KELUAR', amount: r.refundAmount })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at).map((r) => ({ id: r.id, date: r.date, description: r.description, type: r.type, amount: r.amount }))
  const cashIn = rows.filter((r) => r.type === 'MASUK').reduce((s, r) => s + r.amount, 0)
  const cashOut = rows.filter((r) => r.type === 'KELUAR').reduce((s, r) => s + r.amount, 0)
  return { period: { from, to }, cashIn, cashOut, netCash: cashIn - cashOut, rows }
}

export async function lowStock() {
  const products = await prisma.product.findMany({
    where: { isActive: true, stock: { lte: config.lowStockThreshold } }, orderBy: { stock: 'asc' }, select: { id: true, name: true, stock: true },
  })
  return products
}
