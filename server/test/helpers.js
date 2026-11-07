import { createApp } from '../src/app.js'
import { prisma, pool } from '../src/db.js'
import { hashPassword } from '../src/services/passwords.js'

export async function resetDb() {
  await pool.query('TRUNCATE return_items, returns, sale_items, sales, expenses, audit_logs, products, users, session RESTART IDENTITY CASCADE')
}

export async function seedUsers() {
  const owner = await prisma.user.create({ data: { name: 'Owner', username: 'owner', role: 'OWNER', passwordHash: await hashPassword('Owner12345') } })
  const kasir = await prisma.user.create({ data: { name: 'Kasir Satu', username: 'kasir1', role: 'KASIR', passwordHash: await hashPassword('Kasir12345') } })
  const kasir2 = await prisma.user.create({ data: { name: 'Kasir Dua', username: 'kasir2', role: 'KASIR', passwordHash: await hashPassword('Kasir22345') } })
  return { owner, kasir, kasir2 }
}

export async function seedProducts() {
  const a = await prisma.product.create({ data: { name: 'Beras 5 kg', category: 'Sembako', cost: 65000, price: 75000, stock: 25 } })
  const b = await prisma.product.create({ data: { name: 'Minyak 2 L', category: 'Sembako', cost: 30000, price: 35000, stock: 5 } })
  return { a, b }
}

export function startServer(opts) {
  return new Promise((resolve) => {
    const server = createApp(opts).listen(0, () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }))
  })
}
export const stopServer = (server) => new Promise((resolve) => server.close(resolve))

// Klien HTTP dengan cookie jar + token CSRF otomatis.
export class Client {
  constructor(base) { this.base = base; this.cookie = ''; this.csrf = null }
  async req(method, path, body, { csrf = true, headers = {} } = {}) {
    const h = { 'Content-Type': 'application/json', ...headers }
    if (this.cookie) h.Cookie = this.cookie
    if (csrf && this.csrf) h['X-CSRF-Token'] = this.csrf
    const res = await fetch(this.base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
    const set = res.headers.get('set-cookie')
    if (set) this.cookie = set.split(';')[0]
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* bukan JSON */ }
    return { status: res.status, body: json }
  }
  get(p, o) { return this.req('GET', p, undefined, o) }
  post(p, b, o) { return this.req('POST', p, b ?? {}, o) }
  patch(p, b, o) { return this.req('PATCH', p, b, o) }
  del(p, o) { return this.req('DELETE', p, undefined, o) }
  async login(username, password) {
    const r = await this.post('/api/auth/login', { username, password })
    if (r.status === 200) this.csrf = r.body.csrfToken
    return r
  }
}
