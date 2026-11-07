import { prisma, pool } from '../src/db.js'
import { hashPassword } from '../src/services/passwords.js'

const username = (process.env.SEED_OWNER_USERNAME || 'owner').trim().toLowerCase()
const name = process.env.SEED_OWNER_NAME || 'Owner Toko'
const password = process.env.SEED_OWNER_PASSWORD

if (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  console.error('SEED_OWNER_PASSWORD wajib diisi (minimal 8 karakter, huruf + angka).')
  process.exit(1)
}
// Akun owner adalah kunci seluruh data toko: tolak password tebakan umum pada production.
if (process.env.NODE_ENV === 'production') {
  const weak = ['password1', 'admin12345', 'owner12345', 'andra12345', '12345678a', 'qwerty123']
  if (password.length < 10 || weak.includes(password.toLowerCase()) || password.toLowerCase().includes(username)) {
    console.error('SEED_OWNER_PASSWORD terlalu lemah untuk production: minimal 10 karakter, jangan memuat username, jangan pola umum.')
    process.exit(1)
  }
}

const existing = await prisma.user.findUnique({ where: { username } })
if (existing) {
  console.log(`Akun owner "${username}" sudah ada; tidak diubah.`)
} else {
  await prisma.user.create({ data: { name, username, role: 'OWNER', passwordHash: await hashPassword(password) } })
  console.log(`Akun owner "${username}" dibuat.`)
}

// Data contoh bawaan aplikasi lama (src/App.jsx: initialProducts) -- hanya bila belum ada produk.
if (process.env.SEED_SAMPLE_PRODUCTS === 'true' && (await prisma.product.count()) === 0) {
  await prisma.product.createMany({
    data: [
      { name: 'Beras Premium 5 kg', category: 'Sembako', cost: 65000, price: 75000, stock: 25 },
      { name: 'Minyak Goreng 2 L', category: 'Sembako', cost: 30000, price: 35000, stock: 4 },
      { name: 'Gula Pasir 1 kg', category: 'Sembako', cost: 15000, price: 18000, stock: 6 },
    ],
  })
  console.log('3 produk contoh dimasukkan.')
}

await prisma.$disconnect()
await pool.end()
