#!/data/data/com.termux/files/usr/bin/sh
# Pulihkan dari backup: sh termux/restore.sh /path/ke/file.sql.gz  (MENGGANTI seluruh isi database sekarang)
[ -f "$1" ] || { echo "Pakai: sh termux/restore.sh file.sql.gz"; exit 1; }
printf "Ini menimpa semua data sekarang. Ketik YA untuk lanjut: "; read ok; [ "$ok" = "YA" ] || exit 1
dropdb dashboard_profit && createdb dashboard_profit && gunzip -c "$1" | psql -v ON_ERROR_STOP=1 dashboard_profit
