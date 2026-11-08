# Menjalankan di HP Android (Termux)

Panduan penuh ada di percakapan; ini ringkasannya. Skrip di folder `termux/` belum diuji di Android sungguhan:
uji bertahap dan baca pesan error-nya.

1. Pasang **Termux, Termux:Boot, Termux:API dari F-Droid**. Beri Termux autostart dan "Tanpa batasan" baterai, kunci di Recent Apps.
2. `pkg update && pkg upgrade && pkg install nodejs postgresql git cloudflared` lalu `termux-setup-storage`. `node -v` harus 22.18+.
3. Salin proyek ke `~/dashboard-profit`. Folder `server/src/generated` (Prisma client) sudah ikut di zip ini; bila memakai git, salin manual karena di-gitignore.
4. `cd ~/dashboard-profit && sh termux/setup-db.sh` (membuat database + menerapkan migrasi; menampilkan DATABASE_URL).
5. Buat `server/.env` (lihat `server/.env.example` dan `DEPLOY.md`): `NODE_ENV=production`, `DATABASE_URL`, `SESSION_SECRET`,
   `CLIENT_ORIGIN=https://domain-anda`, `TZ_OFFSET_MINUTES=480`, `SEED_OWNER_*`.
6. `npm run build:all` lalu `npm --prefix server run seed` (hapus `SEED_OWNER_PASSWORD` dari `.env` setelahnya).
   Catatan: `build:all` menjalankan `prisma generate`; bila gagal mengunduh engine di Android, lewati dengan
   `npm install --include=dev && npm run build && npm --prefix server install --omit=dev` karena client sudah ada.
7. Tes lokal: `npm --prefix server start`, buka `http://localhost:4000/api/health`.
8. Cloudflare Tunnel: `cloudflared tunnel login`, `tunnel create andra`, `tunnel route dns andra dashboard.domain-anda`,
   lalu `~/.cloudflared/config.yml` (hostname → `http://localhost:4000`). Uji: `cloudflared tunnel run andra`.
9. Otomatis saat boot: `mkdir -p ~/.termux/boot && cp termux/start.sh ~/.termux/boot/ && chmod +x ~/.termux/boot/start.sh`,
   buka aplikasi Termux:Boot sekali, restart HP.
10. Backup jalan otomatis tiap 24 jam ke `Backup-Andra` di penyimpanan HP. **Salin ke laptop/cloud tiap minggu.**
    Pulihkan dengan `sh termux/restore.sh file.sql.gz`.

Log: `~/app.log`, `~/tunnel.log`, `~/pg.log`, `~/backup.log`.
