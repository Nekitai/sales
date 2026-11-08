# Dashboard Profit — Kasir & Manajemen Toko

Aplikasi kasir dan manajemen toko dengan login multi-role (OWNER / KASIR).
Seluruh stack JavaScript: **React + Vite + Tailwind** (frontend), **Node.js + Express** (backend),
**PostgreSQL + Prisma 7** (database). Tanpa PHP/Laravel.

## Struktur folder

```
Dashboard-Profit/
├─ src/                      Frontend React
│  ├─ api/client.js          Satu-satunya modul pemanggil API (cookie session + header CSRF)
│  ├─ auth/                  AuthContext, ProtectedRoute, peran
│  ├─ pages/                 Login, Dashboard, Produk, Penjualan, Persediaan, Pengeluaran, Retur, Laporan, Arus Kas, Pengaturan
│  ├─ components/, layouts/, hooks/, utils/
├─ server/                   Backend Express
│  ├─ prisma/schema.prisma   Skema database
│  ├─ prisma/migrations/     Migrasi SQL
│  ├─ prisma/seed.js         Seed akun owner pertama (+ 3 produk contoh bawaan)
│  ├─ src/routes/            auth, products, sales, expenses, returns, reports, users
│  ├─ src/services/          sales (transaksi), reports (perhitungan), passwords, sessions
│  ├─ src/middleware/        auth/role, CSRF/Origin/CORS, error handler
│  └─ test/                  Pengujian otomatis (node:test)
└─ PROGRESS.md               Catatan progres pengerjaan
```

## Prasyarat

- Node.js **22.18+** (server memakai `--env-file-if-exists`, jadi file `.env` tidak wajib ada di hosting)
- PostgreSQL 14+ (lokal atau server)

## Instalasi

```bash
# 1. Dependensi
npm install                  # frontend
cd server && npm install     # backend

# 2. Database PostgreSQL (contoh)
createdb dashboard_profit

# 3. Konfigurasi backend
cp .env.example .env         # lalu isi DATABASE_URL, SESSION_SECRET, SEED_OWNER_PASSWORD
#   SESSION_SECRET: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
#   Jangan memakai karakter # tanpa tanda kutip di nilai .env (dibaca sebagai komentar).

# 4. Prisma client, migrasi, seed
npm run generate
npm run migrate:deploy       # menerapkan prisma/migrations
npm run seed                 # membuat akun owner pertama
```

### Membuat akun owner

Tidak ada registrasi publik. Akun owner dibuat oleh `npm run seed` memakai
`SEED_OWNER_USERNAME`, `SEED_OWNER_NAME`, dan `SEED_OWNER_PASSWORD` dari `server/.env`
(password minimal 8 karakter, huruf + angka). Seed tidak menimpa akun yang sudah ada.
Setelah login pertama, ganti password di **Pengaturan**, lalu kosongkan `SEED_OWNER_PASSWORD` dari `.env`.
Akun kasir dibuat owner dari halaman **Pengaturan**.

`SEED_SAMPLE_PRODUCTS=true` memasukkan 3 produk contoh bawaan aplikasi lama
(Beras Premium 5 kg, Minyak Goreng 2 L, Gula Pasir 1 kg) hanya bila tabel produk masih kosong.

## Menjalankan

```bash
# terminal 1 — backend (http://localhost:4000)
cd server && npm run dev

# terminal 2 — frontend (http://localhost:5173), /api diproksikan ke backend
npm run dev
```

Buka http://localhost:5173. Owner → `/owner/dashboard`, Kasir → `/kasir/penjualan`.

### Production

Panduan lengkap dan daftar persiapan ada di **DEPLOY.md**. Ringkasnya, satu service Node menyajikan API sekaligus
hasil build frontend (`dist/`), sehingga cookie login satu domain dan tidak perlu CORS:

- Di HP Android: lihat TERMUX.md
- Build: `npm run build:all`  •  Start: `npm run start:prod` (menjalankan migrasi lalu server)
- Wajib di production: `NODE_ENV=production`, `DATABASE_URL`, `SESSION_SECRET` (acak, ≥32 karakter),
  `CLIENT_ORIGIN=https://domain-anda` (server menolak start bila kosong atau bukan https).
- `TRUST_PROXY` otomatis `true` di production (hosting selalu memakai reverse proxy). Tanpa ini cookie `Secure`
  tidak terkirim: login terlihat berhasil tetapi langsung terlempar kembali ke halaman login.
- Frontend dan API beda domain (mis. frontend di Vercel): set `COOKIE_SAMESITE=none`, `SERVE_CLIENT=false`,
  `CLIENT_ORIGIN` ke domain frontend, dan `VITE_API_URL` saat build. Cara ini lebih rapuh (cookie lintas-site sering
  diblokir browser); pilih satu domain bila bisa.

## Tema dan merek

Warna dan huruf mengikuti logo Andra Copotan Makassar dan didefinisikan sekali di `src/index.css` (`@theme`):
`aspal` (hitam/abu krom), `racing` (merah), `lemon` (kuning). Huruf: Barlow Condensed (judul) dan Barlow (isi),
dipasang lewat paket `@fontsource` sehingga tidak ada permintaan ke Google Fonts. Logo ada di `public/logo.webp`;
ikon situs dibuat dari logo yang sama. Tombol memakai kelas `btn-primary` (merah) dan `btn-accent` (kuning).

## Pengujian

```bash
createdb dashboard_profit_test
# buat server/.env.test (salin dari .env, ganti DATABASE_URL ke dashboard_profit_test, NODE_ENV=test)
# terapkan migrasi ke database test: psql -f server/prisma/migrations/*/migration.sql  (atau migrate:deploy dengan DATABASE_URL test)
npm run server:test          # 28 tes backend
npm run lint && npm run build
```

Cakupan tes backend: login/redirect per role, password salah, bcrypt, logout mematikan session, 401 tanpa login,
rate limit login, CSRF, Origin asing, 403 kasir ke endpoint owner, transaksi valid, total dihitung server,
stok kurang ditolak + rollback, transaksi bersamaan (10 request / stok 5; 2 × qty 3 / stok 5), snapshot harga,
persistensi setelah restart, retur (proporsional diskon, bersamaan), laporan & arus kas, filter periode,
laba disembunyikan bila HPP tidak valid, validasi input.

## Aturan bisnis

- **Uang**: integer rupiah. Tidak ada floating point.
- **Transaksi** (`POST /api/sales`, hanya KASIR): server mengambil ulang harga/HPP dari DB, menghitung total,
  mengurangi stok dengan `UPDATE ... WHERE stock >= qty` atomik di dalam satu DB transaction (aman untuk transaksi
  bersamaan), menyimpan snapshot harga jual & HPP per item, dan mencatat kasir dari session.
- **Diskon**: nominal per transaksi, maksimal `MAX_CASHIER_DISCOUNT_PERCENT` (default 10%) dari subtotal, dialokasikan
  proporsional ke tiap baris. Kasir tidak dapat mengubah harga jual, modal, maupun stok.
- **Produk**: modal > 0, harga jual ≥ modal. "Hapus" = nonaktifkan (riwayat transaksi tetap utuh).
- **Retur** (OWNER): refund = bagian proporsional dari nilai baris *setelah diskon*; stok kembali; retur tidak boleh
  melebihi sisa kuantitas terjual (baris transaksi dikunci `FOR UPDATE`).

### Rumus laporan (per periode)

| Angka | Rumus |
|---|---|
| Penjualan | Σ total transaksi (setelah diskon) |
| Omzet bersih | Penjualan − nilai retur (retur dicatat pada tanggal retur) |
| HPP | Σ HPP snapshot terjual − HPP barang yang diretur |
| Laba kotor | Omzet bersih − HPP |
| Laba operasional | Laba kotor − pengeluaran |
| Kas masuk / keluar | Total penjualan / (pengeluaran + refund retur) |

Laba **tidak ditampilkan** (`null`) bila ada item terjual dengan HPP ≤ 0. Pembelian stok tidak dicatat di aplikasi
ini sehingga tidak masuk arus kas.

## Daftar endpoint

Semua di bawah `/api`. Respons error: `{ "error": { "message", "details?" } }`.
Request yang mengubah data (non-GET) setelah login wajib header `X-CSRF-Token` (didapat dari login / `GET /auth/me`).

| Method & path | Keterangan |
|---|---|
| `POST /auth/login` | Login (rate limit: 10 gagal / 15 menit per IP) |
| `POST /auth/logout` | Hapus session di server |
| `GET /auth/me` | User saat ini + token CSRF |
| `POST /auth/change-password` | Ganti password sendiri |
| `GET /products` | OWNER: semua + modal; KASIR: hanya aktif, tanpa modal |
| `POST /products`, `PATCH /products/:id`, `DELETE /products/:id` | Kelola produk (nonaktifkan) |
| `POST /sales` | Buat transaksi |
| `GET /sales`, `GET /sales/:id` | Riwayat (OWNER semua; KASIR milik sendiri) |
| `GET /expenses`, `POST /expenses` | Pengeluaran |
| `GET /returns`, `POST /returns` | Retur |
| `GET /reports/dashboard`, `/reports/summary`, `/reports/cashflow`, `/reports/sales` | Ringkasan, laporan, arus kas (`?from=&to=`) |
| `GET /users`, `POST /users`, `PATCH /users/:id`, `POST /users/:id/reset-password` | Akun kasir |

## Matriks izin

| Aksi | OWNER | KASIR | Tanpa login |
|---|:-:|:-:|:-:|
| Login / logout / ganti password sendiri | ✔ | ✔ | login saja |
| Lihat produk aktif, harga jual, stok | ✔ | ✔ | ✘ |
| Lihat harga modal / produk nonaktif | ✔ | ✘ | ✘ |
| Tambah / ubah / nonaktifkan produk, ubah harga & stok | ✔ | ✘ | ✘ |
| Buat transaksi penjualan | ✘ | ✔ | ✘ |
| Riwayat transaksi | semua kasir | milik sendiri | ✘ |
| Pengeluaran | ✔ | ✘ | ✘ |
| Retur | ✔ | ✘ | ✘ |
| Dashboard, laporan, arus kas (omzet, HPP, laba) | ✔ | ✘ | ✘ |
| Kelola akun kasir (buat, nonaktifkan, reset password) | ✔ | ✘ | ✘ |

Penegakan izin ada di backend (middleware `requireAuth` + `ownerOnly`/`kasirOnly`); redirect frontend hanya kenyamanan UX.

## Keamanan

bcrypt (12 putaran) • session server-side di PostgreSQL, cookie `HttpOnly`, `Secure` di production, `SameSite=Lax` (konfigurabel),
session diregenerasi saat login • rate limit per IP+username (satu akun yang diserang tidak mengunci akun lain) •
CSP, HSTS, X-Frame-Options di production • seed menolak password lemah di production • akun nonaktif langsung kehilangan akses (user dimuat dari DB tiap request) •
CSRF synchronizer token + pengecekan Origin • rate limit login • validasi zod di backend • tidak ada hash/rahasia di respons •
semua rahasia lewat environment variable • audit log perubahan produk/pengguna/transaksi/retur.
