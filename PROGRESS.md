# PROGRESS

SELESAI (diuji): backend 30/30 tes lulus, lint bersih, build frontend sukses, uji browser (Chromium) alur login/refresh/keluar/deep link.

v3 (tema + login siap deploy):
- Tema mengikuti logo Andra Copotan Makassar (hitam, merah, kuning, krom), huruf Barlow self-hosted.
- Login: CLIENT_ORIGIN wajib di production, TRUST_PROXY otomatis, rate limit per IP+username, clearCookie dengan atribut sama,
  CSP/HSTS, seed menolak password lemah, redirect kembali ke halaman tujuan, tombol tampilkan password.
- Satu service: server menyajikan dist/ (+ fallback SPA). Lihat DEPLOY.md.

Belum/terbuka:
- `prisma migrate deploy` belum bisa diuji di sandbox (binary schema-engine diblokir jaringan); SQL migrasi sudah diuji via psql.
  Uji `npm run start:prod` di hosting; cadangan: terapkan migration.sql dengan psql.
- Data produk masih generik (nama, kategori, modal, harga, stok). Untuk copotan, pertimbangkan kolom merek/tipe mobil, tahun, kondisi, lokasi rak.
- Opsional: retur multi-barang di UI, void transaksi, pencatatan pembelian stok, cetak struk, tes frontend otomatis.
