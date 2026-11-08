#!/data/data/com.termux/files/usr/bin/sh
# Backup database ke penyimpanan HP (butuh: termux-setup-storage sekali). Menyimpan 14 file terakhir.
# SALIN file hasilnya ke laptop/cloud secara berkala: backup yang hanya ada di HP ikut hilang bila HP rusak.
DEST="$HOME/storage/shared/Backup-Andra"
mkdir -p "$DEST" || { echo "Folder backup tidak bisa dibuat. Jalankan: termux-setup-storage"; exit 1; }
FILE="$DEST/dashboard_profit-$(date +%F_%H%M).sql.gz"
if pg_dump dashboard_profit | gzip > "$FILE" && [ -s "$FILE" ]; then
  echo "$(date) OK $FILE"
else
  echo "$(date) GAGAL"; rm -f "$FILE"; exit 1
fi
ls -1t "$DEST"/dashboard_profit-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
