#!/data/data/com.termux/files/usr/bin/sh
# Jalankan SEKALI di Termux, dari folder proyek: sh termux/setup-db.sh
# Membuat cluster PostgreSQL, database dashboard_profit, dan menerapkan migrasi SQL (tanpa Prisma CLI).
set -e
PGDIR="$PREFIX/var/lib/postgresql"
if [ ! -d "$PGDIR/base" ]; then
  mkdir -p "$PGDIR"
  initdb "$PGDIR"
fi
pg_ctl -D "$PGDIR" -l "$HOME/pg.log" status >/dev/null 2>&1 || pg_ctl -D "$PGDIR" -l "$HOME/pg.log" start
sleep 3
createdb dashboard_profit 2>/dev/null || echo "Database dashboard_profit sudah ada."
if psql -tAc "SELECT to_regclass('public.users')" dashboard_profit | grep -q users; then
  echo "Migrasi sudah pernah diterapkan, dilewati."
else
  psql -v ON_ERROR_STOP=1 dashboard_profit -f server/prisma/migrations/20261025000000_init/migration.sql
  echo "Migrasi diterapkan."
fi
echo "DATABASE_URL=postgresql://$(whoami)@localhost:5432/dashboard_profit"
