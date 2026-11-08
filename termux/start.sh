#!/data/data/com.termux/files/usr/bin/sh
# Salin ke ~/.termux/boot/start.sh lalu: chmod +x ~/.termux/boot/start.sh
# Dijalankan Termux:Boot saat HP menyala. Ubah APP bila folder proyek berbeda.
APP="$HOME/dashboard-profit"
TUNNEL="andra"

termux-wake-lock
pg_ctl -D "$PREFIX/var/lib/postgresql" -l "$HOME/pg.log" start
sleep 5

cd "$APP/server" || exit 1
nohup node --env-file-if-exists=.env src/index.js >> "$HOME/app.log" 2>&1 &
nohup cloudflared tunnel run "$TUNNEL" >> "$HOME/tunnel.log" 2>&1 &

# Backup harian (jalan pertama 1 menit setelah boot, lalu tiap 24 jam).
(
  sleep 60
  while true; do
    sh "$APP/termux/backup.sh" >> "$HOME/backup.log" 2>&1
    sleep 86400
  done
) &
