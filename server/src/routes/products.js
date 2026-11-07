import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { ownerOnly } from '../middleware/auth.js'
import { audit } from '../utils/audit.js'
import { badRequest, notFound, wrap } from '../utils/errors.js'
import { parse } from '../utils/validate.js'

const router = Router()

const money = (label) => z.number({ error: `${label} harus berupa angka.` }).int(`${label} harus bilangan bulat (rupiah).`).min(0, `${label} tidak boleh negatif.`).max(1_000_000_000)

const baseSchema = z.object({
  name: z.string().trim().min(1, 'Nama produk wajib diisi.').max(120),
  category: z.string().trim().max(60).default(''),
  cost: money('Harga modal').refine((v) => v > 0, 'Harga modal harus lebih dari 0.'),
  price: money('Harga jual'),
  stock: z.number().int('Stok harus bilangan bulat.').min(0, 'Stok tidak boleh negatif.').max(10_000_000),
  isActive: z.boolean().default(true),
})
const createSchema = baseSchema
const patchSchema = baseSchema.partial()

const ownerView = (p) => ({ id: p.id, name: p.name, category: p.category, cost: p.cost, price: p.price, stock: p.stock, isActive: p.isActive })
const kasirView = (p) => ({ id: p.id, name: p.name, category: p.category, price: p.price, stock: p.stock })

router.get('/', wrap(async (req, res) => {
  const isOwner = req.user.role === 'OWNER'
  const products = await prisma.product.findMany({
    where: isOwner ? {} : { isActive: true },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })
  res.json({ products: products.map(isOwner ? ownerView : kasirView) })
}))

router.post('/', ownerOnly, wrap(async (req, res) => {
  const data = parse(createSchema, req.body)
  if (data.price < data.cost) throw badRequest('Harga jual tidak boleh lebih rendah dari harga modal.')
  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({ data })
    await audit(tx, req.user.id, 'CREATE_PRODUCT', 'product', p.id, data)
    return p
  })
  res.status(201).json({ product: ownerView(product) })
}))

router.patch('/:id', ownerOnly, wrap(async (req, res) => {
  const id = Number(req.params.id) || 0
  const data = parse(patchSchema, req.body)
  const product = await prisma.$transaction(async (tx) => {
    const before = await tx.product.findUnique({ where: { id } })
    if (!before) throw notFound('Produk tidak ditemukan.')
    const next = { ...before, ...data }
    if (next.price < next.cost) throw badRequest('Harga jual tidak boleh lebih rendah dari harga modal.')
    const p = await tx.product.update({ where: { id }, data })
    const changes = Object.fromEntries(Object.keys(data).filter((k) => data[k] !== before[k]).map((k) => [k, { from: before[k], to: data[k] }]))
    await audit(tx, req.user.id, 'UPDATE_PRODUCT', 'product', id, changes)
    return p
  })
  res.json({ product: ownerView(product) })
}))

// "Hapus" = nonaktifkan, agar riwayat transaksi tetap utuh.
router.delete('/:id', ownerOnly, wrap(async (req, res) => {
  const id = Number(req.params.id) || 0
  const exists = await prisma.product.findUnique({ where: { id } })
  if (!exists) throw notFound('Produk tidak ditemukan.')
  const product = await prisma.product.update({ where: { id }, data: { isActive: false } })
  await audit(prisma, req.user.id, 'DEACTIVATE_PRODUCT', 'product', id)
  res.json({ product: ownerView(product) })
}))

export default router
