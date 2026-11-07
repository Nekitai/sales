import { after, before, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { prisma, pool } from '../src/db.js'
import { Client, resetDb, seedProducts, seedUsers, startServer, stopServer } from './helpers.js'

let server, base, users, products

before(async () => { ({ server, base } = await startServer({ loginLimitMax: 1000 })) })
after(async () => { await stopServer(server); await prisma.$disconnect(); await pool.end() })
beforeEach(async () => { await resetDb(); users = await seedUsers(); products = await seedProducts() })

const as = async (u, p) => { const c = new Client(base); const r = await c.login(u, p); assert.equal(r.status, 200); return c }
const owner = () => as('owner', 'Owner12345')
const kasir = () => as('kasir1', 'Kasir12345')
const sale = (c, items, extra = {}) => c.post('/api/sales', { items, paymentMethod: 'CASH', ...extra })

describe('autentikasi', () => {
  test('login owner -> /owner/dashboard, kasir -> /kasir/penjualan', async () => {
    const o = new Client(base); const ro = await o.login('owner', 'Owner12345')
    assert.equal(ro.body.redirectTo, '/owner/dashboard'); assert.equal(ro.body.user.role, 'OWNER')
    assert.equal(ro.body.user.passwordHash, undefined)
    const k = new Client(base); const rk = await k.login('kasir1', 'Kasir12345')
    assert.equal(rk.body.redirectTo, '/kasir/penjualan')
  })
  test('password salah / user tidak ada ditolak dengan pesan sama', async () => {
    const c = new Client(base)
    const a = await c.login('owner', 'salah-salah1'); const b = await c.login('hantu', 'salah-salah1')
    assert.equal(a.status, 401); assert.equal(b.status, 401); assert.equal(a.body.error.message, b.body.error.message)
  })
  test('hash password tersimpan bcrypt, bukan teks biasa', async () => {
    const u = await prisma.user.findUnique({ where: { username: 'owner' } })
    assert.match(u.passwordHash, /^\$2[aby]\$/); assert.notEqual(u.passwordHash, 'Owner12345')
  })
  test('logout mengakhiri session di server', async () => {
    const c = await kasir()
    assert.equal((await c.get('/api/products')).status, 200)
    const oldCookie = c.cookie; const oldCsrf = c.csrf
    assert.equal((await c.post('/api/auth/logout')).status, 200)
    const stale = new Client(base); stale.cookie = oldCookie; stale.csrf = oldCsrf
    assert.equal((await stale.get('/api/products')).status, 401)
    assert.equal((await stale.get('/api/auth/me')).status, 401)
  })
  test('endpoint terproteksi menolak request tanpa login', async () => {
    const c = new Client(base)
    for (const p of ['/api/products', '/api/sales', '/api/reports/summary', '/api/users', '/api/auth/me']) {
      assert.equal((await c.get(p)).status, 401, p)
    }
  })
  test('rate limit login', async () => {
    const { server: s, base: b } = await startServer({ loginLimitMax: 3 })
    try {
      const c = new Client(b); const codes = []
      for (let i = 0; i < 5; i++) codes.push((await c.login('owner', 'salah-salah1')).status)
      assert.deepEqual(codes, [401, 401, 401, 429, 429])
    } finally { await stopServer(s) }
  })
  test('rate limit login per username: akun lain di IP yang sama tidak ikut terkunci', async () => {
    const { server: s, base: b } = await startServer({ loginLimitMax: 3 })
    try {
      const c = new Client(b)
      for (let i = 0; i < 4; i++) await c.login('owner', 'salah-salah1')
      assert.equal((await c.login('owner', 'Owner12345')).status, 429)
      const other = new Client(b)
      assert.equal((await other.login('kasir1', 'Kasir12345')).status, 200)
    } finally { await stopServer(s) }
  })
  test('logout menghapus cookie dengan atribut yang sama', async () => {
    const c = await owner()
    const res = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: c.cookie, 'X-CSRF-Token': c.csrf }, body: '{}' })
    const set = res.headers.get('set-cookie') || ''
    assert.match(set, /dp\.sid=;/)
    assert.match(set, /HttpOnly/i)
    assert.equal((await new Client(base).get('/api/auth/me')).status, 401)
  })
  test('CSRF: mutasi tanpa/dengan token salah ditolak', async () => {
    const c = await owner()
    const noToken = await c.post('/api/expenses', { description: 'x', amount: 1000 }, { csrf: false })
    assert.equal(noToken.status, 403)
    const bad = await c.post('/api/expenses', { description: 'x', amount: 1000 }, { csrf: false, headers: { 'X-CSRF-Token': 'salah' } })
    assert.equal(bad.status, 403)
    assert.equal((await c.post('/api/expenses', { description: 'x', amount: 1000 })).status, 201)
  })
  test('Origin asing ditolak pada request mengubah data', async () => {
    const r = await new Client(base).post('/api/auth/login', { username: 'owner', password: 'Owner12345' }, { headers: { Origin: 'http://evil.example' } })
    assert.equal(r.status, 403)
  })
})

describe('otorisasi role', () => {
  test('kasir tidak bisa mengakses endpoint owner', async () => {
    const c = await kasir()
    const checks = [
      ['get', '/api/reports/summary'], ['get', '/api/reports/dashboard'], ['get', '/api/reports/cashflow'], ['get', '/api/reports/sales'],
      ['get', '/api/expenses'], ['post', '/api/expenses', { description: 'x', amount: 5000 }],
      ['get', '/api/returns'], ['post', '/api/returns', { saleId: 1, items: [{ saleItemId: 1, qty: 1 }] }],
      ['get', '/api/users'], ['post', '/api/users', { name: 'x', username: 'xxx', password: 'Abcdefg1' }],
      ['post', '/api/products', { name: 'x', cost: 1, price: 2, stock: 1 }],
      ['patch', `/api/products/${products.a.id}`, { price: 1 }], ['del', `/api/products/${products.a.id}`],
    ]
    for (const [m, p, b] of checks) assert.equal((await c[m](p, b)).status, 403, `${m} ${p}`)
    const p = await prisma.product.findUnique({ where: { id: products.a.id } })
    assert.equal(p.price, 75000)
  })
  test('owner tidak bisa membuat transaksi (khusus kasir)', async () => {
    const c = await owner()
    assert.equal((await sale(c, [{ productId: products.a.id, qty: 1 }])).status, 403)
  })
  test('kasir tidak melihat harga modal; hanya produk aktif', async () => {
    const o = await owner(); await o.del(`/api/products/${products.b.id}`)
    const k = await kasir(); const r = await k.get('/api/products')
    assert.equal(r.body.products.length, 1)
    assert.equal(r.body.products[0].cost, undefined); assert.equal(r.body.products[0].isActive, undefined)
  })
  test('kasir hanya melihat transaksi miliknya; owner melihat semua', async () => {
    const k1 = await kasir(); const k2 = await as('kasir2', 'Kasir22345'); const o = await owner()
    const s1 = (await sale(k1, [{ productId: products.a.id, qty: 1 }])).body.sale
    await sale(k2, [{ productId: products.a.id, qty: 1 }])
    assert.equal((await k1.get('/api/sales')).body.sales.length, 1)
    assert.equal((await k2.get(`/api/sales/${s1.id}`)).status, 403)
    const all = await o.get('/api/sales'); assert.equal(all.body.sales.length, 2)
    assert.ok(all.body.sales[0].items[0].unitCost > 0)
    const mine = (await k1.get('/api/sales')).body.sales[0]
    assert.equal(mine.items[0].unitCost, undefined)
  })
  test('akun kasir dinonaktifkan langsung kehilangan session; password direset', async () => {
    const k = await kasir(); const o = await owner()
    assert.equal((await k.get('/api/products')).status, 200)
    assert.equal((await o.patch(`/api/users/${users.kasir.id}`, { isActive: false })).status, 200)
    assert.equal((await k.get('/api/products')).status, 401)
    assert.equal((await new Client(base).login('kasir1', 'Kasir12345')).status, 401)
    await o.patch(`/api/users/${users.kasir.id}`, { isActive: true })
    assert.equal((await o.post(`/api/users/${users.kasir.id}/reset-password`, { newPassword: 'BaruBaru99' })).status, 200)
    assert.equal((await new Client(base).login('kasir1', 'Kasir12345')).status, 401)
    assert.equal((await new Client(base).login('kasir1', 'BaruBaru99')).status, 200)
  })
  test('owner tidak bisa menonaktifkan akun owner lewat endpoint kasir', async () => {
    const o = await owner()
    assert.equal((await o.patch(`/api/users/${users.owner.id}`, { isActive: false })).status, 404)
  })
})

describe('transaksi penjualan', () => {
  test('transaksi valid tersimpan; total dihitung server (field total dari klien diabaikan)', async () => {
    const k = await kasir()
    const r = await sale(k, [{ productId: products.a.id, qty: 2 }, { productId: products.b.id, qty: 1 }], { total: 1, price: 1, amountPaid: 300000 })
    assert.equal(r.status, 201)
    assert.equal(r.body.sale.subtotal, 2 * 75000 + 35000); assert.equal(r.body.sale.total, 185000)
    assert.equal(r.body.sale.change, 115000); assert.match(r.body.sale.invoiceNo, /^INV-\d{8}-\d{6}$/)
    const db = await prisma.sale.findUnique({ where: { id: r.body.sale.id }, include: { items: true } })
    assert.equal(db.cashierId, users.kasir.id); assert.equal(db.items.length, 2)
    assert.equal((await prisma.product.findUnique({ where: { id: products.a.id } })).stock, 23)
  })
  test('kuantitas melebihi stok ditolak, tidak ada yang tersimpan, stok utuh', async () => {
    const k = await kasir()
    const r = await sale(k, [{ productId: products.a.id, qty: 1 }, { productId: products.b.id, qty: 6 }])
    assert.equal(r.status, 409)
    assert.equal(await prisma.sale.count(), 0)
    assert.equal((await prisma.product.findUnique({ where: { id: products.a.id } })).stock, 25) // rollback penuh
  })
  test('input tidak valid ditolak (qty 0, negatif, desimal, produk nonaktif, diskon berlebih)', async () => {
    const k = await kasir(); const pid = products.a.id
    for (const qty of [0, -1, 1.5, '2']) assert.equal((await sale(k, [{ productId: pid, qty }])).status, 400, String(qty))
    assert.equal((await sale(k, [])).status, 400)
    assert.equal((await sale(k, [{ productId: 9999, qty: 1 }])).status, 400)
    assert.equal((await sale(k, [{ productId: pid, qty: 1 }], { discount: -5 })).status, 400)
    assert.equal((await sale(k, [{ productId: pid, qty: 1 }], { discount: 7501 })).status, 400) // > 10%
    assert.equal((await sale(k, [{ productId: pid, qty: 1 }], { amountPaid: 100 })).status, 400)
    assert.equal((await sale(k, [{ productId: pid, qty: 1 }], { paymentMethod: 'BITCOIN' })).status, 400)
    await prisma.product.update({ where: { id: pid }, data: { isActive: false } })
    assert.equal((await sale(k, [{ productId: pid, qty: 1 }])).status, 400)
    assert.equal(await prisma.sale.count(), 0)
  })
  test('diskon dalam batas: dialokasikan ke baris dan total konsisten', async () => {
    const k = await kasir()
    const r = await sale(k, [{ productId: products.a.id, qty: 1 }, { productId: products.b.id, qty: 1 }], { discount: 11000 })
    assert.equal(r.status, 201); assert.equal(r.body.sale.total, 99000)
    assert.equal(r.body.sale.items.reduce((s, i) => s + i.lineDiscount, 0), 11000)
    assert.equal(r.body.sale.items.reduce((s, i) => s + i.lineTotal, 0), 99000)
  })
  test('transaksi bersamaan tidak membuat stok negatif (10 request, stok 5)', async () => {
    const clients = await Promise.all(Array.from({ length: 10 }, () => kasir()))
    const results = await Promise.all(clients.map((c) => sale(c, [{ productId: products.b.id, qty: 1 }])))
    assert.equal(results.filter((r) => r.status === 201).length, 5)
    assert.equal(results.filter((r) => r.status === 409).length, 5)
    assert.equal((await prisma.product.findUnique({ where: { id: products.b.id } })).stock, 0)
    assert.equal(await prisma.sale.count(), 5)
  })
  test('dua transaksi qty 3 bersamaan pada stok 5: hanya satu berhasil', async () => {
    const [c1, c2] = await Promise.all([kasir(), kasir()])
    const r = await Promise.all([sale(c1, [{ productId: products.b.id, qty: 3 }]), sale(c2, [{ productId: products.b.id, qty: 3 }])])
    assert.deepEqual(r.map((x) => x.status).sort(), [201, 409])
    assert.equal((await prisma.product.findUnique({ where: { id: products.b.id } })).stock, 2)
  })
  test('snapshot harga/HPP transaksi lama tidak berubah saat harga produk diubah', async () => {
    const k = await kasir(); const o = await owner()
    const s = (await sale(k, [{ productId: products.a.id, qty: 2 }])).body.sale
    assert.equal((await o.patch(`/api/products/${products.a.id}`, { price: 90000, cost: 70000 })).status, 200)
    const after = (await o.get(`/api/sales/${s.id}`)).body.sale
    assert.equal(after.items[0].unitPrice, 75000); assert.equal(after.items[0].unitCost, 65000); assert.equal(after.total, 150000)
    const s2 = (await sale(k, [{ productId: products.a.id, qty: 1 }])).body.sale
    assert.equal(s2.items[0].unitPrice, 90000)
  })
  test('data tetap ada setelah server direstart', async () => {
    const k = await kasir(); await sale(k, [{ productId: products.a.id, qty: 1 }])
    const { server: s2, base: b2 } = await startServer({ loginLimitMax: 1000 })
    try {
      const o = new Client(b2); assert.equal((await o.login('owner', 'Owner12345')).status, 200)
      assert.equal((await o.get('/api/sales')).body.sales.length, 1)
      // session lama (di PostgreSQL) juga tetap valid di instance baru
      const old = new Client(b2); old.cookie = k.cookie; old.csrf = k.csrf
      assert.equal((await old.get('/api/auth/me')).status, 200)
    } finally { await stopServer(s2) }
  })
})

describe('retur, laporan, arus kas', () => {
  test('retur: refund proporsional setelah diskon, stok kembali, tidak melebihi sisa', async () => {
    const k = await kasir(); const o = await owner()
    const s = (await sale(k, [{ productId: products.a.id, qty: 3 }], { discount: 22500 })).body.sale // 225000-22500=202500
    const item = s.items[0]
    const r1 = await o.post('/api/returns', { saleId: s.id, items: [{ saleItemId: item.id, qty: 1 }] })
    assert.equal(r1.status, 201); assert.equal(r1.body.return.refundAmount, 67500)
    assert.equal((await prisma.product.findUnique({ where: { id: products.a.id } })).stock, 23)
    assert.equal((await o.post('/api/returns', { saleId: s.id, items: [{ saleItemId: item.id, qty: 3 }] })).status, 409)
    const r2 = await o.post('/api/returns', { saleId: s.id, items: [{ saleItemId: item.id, qty: 2 }] })
    assert.equal(r1.body.return.refundAmount + r2.body.return.refundAmount, 202500) // total refund == nilai baris
    assert.equal((await prisma.product.findUnique({ where: { id: products.a.id } })).stock, 25)
  })
  test('retur bersamaan tidak melebihi kuantitas terjual', async () => {
    const k = await kasir(); const o = await owner()
    const s = (await sale(k, [{ productId: products.a.id, qty: 2 }])).body.sale
    const rs = await Promise.all(Array.from({ length: 4 }, () => o.post('/api/returns', { saleId: s.id, items: [{ saleItemId: s.items[0].id, qty: 1 }] })))
    assert.equal(rs.filter((r) => r.status === 201).length, 2)
    assert.equal((await prisma.product.findUnique({ where: { id: products.a.id } })).stock, 25)
  })
  test('laporan konsisten: omzet, HPP, laba kotor, laba operasional; retur & biaya tidak dihitung dua kali', async () => {
    const k = await kasir(); const o = await owner()
    const s = (await sale(k, [{ productId: products.a.id, qty: 4 }])).body.sale // 300000, HPP 260000
    await o.post('/api/returns', { saleId: s.id, items: [{ saleItemId: s.items[0].id, qty: 1 }] }) // refund 75000, HPP kembali 65000
    await o.post('/api/expenses', { description: 'Listrik', amount: 20000 })
    const r = (await o.get('/api/reports/summary')).body
    assert.equal(r.salesTotal, 300000); assert.equal(r.returns, 75000); assert.equal(r.netSales, 225000)
    assert.equal(r.hpp, 195000); assert.equal(r.grossProfit, 30000); assert.equal(r.expenses, 20000); assert.equal(r.operatingProfit, 10000)
    const cf = (await o.get('/api/reports/cashflow')).body
    assert.equal(cf.cashIn, 300000); assert.equal(cf.cashOut, 95000); assert.equal(cf.netCash, 205000)
    assert.notEqual(cf.netCash, r.operatingProfit) // kas != laba
    const dash = (await o.get('/api/reports/dashboard')).body
    assert.equal(dash.summary.netSales, 225000); assert.ok(dash.inventoryValue > 0)
  })
  test('filter periode: transaksi di luar rentang tidak ikut dihitung', async () => {
    const k = await kasir(); const o = await owner()
    await sale(k, [{ productId: products.a.id, qty: 1 }])
    const r = (await o.get('/api/reports/summary?from=2020-01-01&to=2020-01-31')).body
    assert.equal(r.salesTotal, 0); assert.equal(r.transactionCount, 0)
    assert.equal((await o.get('/api/reports/summary?from=bukan-tanggal')).status, 400)
    assert.equal((await o.get('/api/reports/summary?from=2026-02-01&to=2026-01-01')).status, 400)
  })
  test('laba tidak ditampilkan bila ada HPP tidak valid (Rp 0)', async () => {
    const k = await kasir(); const o = await owner()
    await sale(k, [{ productId: products.a.id, qty: 1 }])
    await pool.query('UPDATE sale_items SET unit_cost = 0') // simulasi data rusak
    const r = (await o.get('/api/reports/summary')).body
    assert.equal(r.dataValid, false); assert.equal(r.grossProfit, null); assert.equal(r.operatingProfit, null)
    assert.ok(r.warnings.length > 0)
  })
  test('validasi produk & pengeluaran', async () => {
    const o = await owner()
    assert.equal((await o.post('/api/products', { name: 'A', cost: 0, price: 5, stock: 1 })).status, 400)
    assert.equal((await o.post('/api/products', { name: 'A', cost: 100, price: 50, stock: 1 })).status, 400)
    assert.equal((await o.post('/api/products', { name: 'A', cost: 100, price: 150, stock: -1 })).status, 400)
    assert.equal((await o.post('/api/products', { name: 'A', cost: 100, price: 150.5, stock: 1 })).status, 400)
    assert.equal((await o.post('/api/products', { name: 'Baru', cost: 100, price: 150, stock: 3 })).status, 201)
    assert.equal((await o.post('/api/expenses', { description: 'x', amount: 0 })).status, 400)
    assert.equal((await o.post('/api/expenses', { description: 'x', amount: 100, date: '2026-13-45' })).status, 400)
  })
})
