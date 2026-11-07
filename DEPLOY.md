# Panduan deploy — Dashboard Profit (Andra Copotan Makassar)

Rancangan paling sederhana: **satu service Node + satu database PostgreSQL**. Service itu menyajikan API dan
halaman web sekaligus, jadi login (cookie) bekerja di satu domain tanpa pengaturan CORS.

## 1. Yang harus disiapkan

| Kebutuhan | Keterangan |
|---|---|
| Hosting Node.js 22.18+ | Railway, Render, Fly.io, atau VPS. Periksa harga dan batas paket gratis terbaru di situs masing-masing; beberapa paket gratis menidurkan service atau menghapus database setelah beberapa waktu, tidak cocok untuk data transaksi toko. |
| Database PostgreSQL 14+ | Bisa dari hosting yang sama atau layanan terpisah (Neon, Supabase, dll). Siapkan `DATABASE_URL`. |
| Domain (disarankan) | Mis. `dashboard.namadomain.com`, HTTPS otomatis dari hosting. Tanpa domain, pakai URL bawaan hosting (`https://xxx.up.railway.app`) sebagai `CLIENT_ORIGIN`. |
| Repositori Git | Unggah proyek ini ke GitHub/GitLab (file `.env` jangan ikut; sudah ada di `.gitignore`). |
| Password owner kuat | Minimal 10 karakter, jangan memuat username, jangan pola umum. Simpan di pengelola password. |
| Rencana backup | Aktifkan backup otomatis database di penyedia, atau jadwalkan `pg_dump`. |

## 2. Variabel lingkungan (isi di menu Environment Variables hosting)

```
NODE_ENV=production
DATABASE_URL=postgresql://...            # dari penyedia database
SESSION_SECRET=<48 byte acak>            # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
CLIENT_ORIGIN=https://dashboard.namadomain.com   # persis sama dengan alamat di browser, tanpa / di akhir
TZ_OFFSET_MINUTES=480                    # WITA (Makassar)
SEED_OWNER_USERNAME=owner
SEED_OWNER_NAME=Nama Owner
SEED_OWNER_PASSWORD=<password kuat>      # hanya untuk langkah seed, hapus setelahnya
```

`PORT` biasanya diisi otomatis oleh hosting. `TRUST_PROXY` dan `SERVE_CLIENT` tidak perlu diisi (otomatis aktif di production).

## 3. Perintah

- Build command: `npm run build:all`
- Start command: `npm run start:prod`
- Sekali saja setelah deploy pertama (shell/console hosting): `npm --prefix server run seed`
  lalu **hapus `SEED_OWNER_PASSWORD`** dari variabel lingkungan.

Bila `migrate deploy` gagal di hosting, terapkan `server/prisma/migrations/20261025000000_init/migration.sql`
langsung ke database dengan `psql`, lalu start ulang.

## 4. Uji setelah deploy

1. Buka `https://domain-anda/api/health` → `{"ok":true}`.
2. Buka halaman utama, login sebagai owner, **refresh halaman** (harus tetap masuk).
3. Ganti password owner di Pengaturan, buat akun kasir, login kasir dari HP dan catat satu transaksi uji.
4. Cek salah password 3x tidak mengunci akun lain.

## 5. Bila login bermasalah

| Gejala | Penyebab umum |
|---|---|
| "Origin tidak diizinkan" | `CLIENT_ORIGIN` tidak sama persis dengan alamat di browser (http vs https, www, garis miring). |
| Login sukses lalu kembali ke halaman login | Cookie tidak terkirim: akses lewat `http://` bukan https, atau `TRUST_PROXY=false` di belakang proxy. |
| Server tidak mau start | Pesan error menyebut variabel yang kurang/tidak valid (CLIENT_ORIGIN, SESSION_SECRET). |
| "Terlalu banyak percobaan login" | 10 salah per akun per 15 menit; tunggu atau restart service. |
| Halaman putih / 404 saat refresh | `dist/` belum ada: build belum dijalankan. |
