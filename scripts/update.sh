#!/usr/bin/env bash
# Depot Air — one-shot update script.
# Run sebagai root: sudo /opt/depot-air/scripts/update.sh
#
# Yang dilakukan:
#   1. git pull sebagai user depot (cegah dubious-ownership)
#   2. npm install kalau package.json/lock berubah
#   3. npm run build
#   4. drizzle migrate kalau ada SQL baru
#   5. systemctl restart depot-air
#
# Backfill / db:seed / db:create-admin TIDAK dijalankan otomatis — itu
# operasi sekali pakai, panggil manual sesuai kebutuhan.

set -euo pipefail

APP_DIR="/opt/depot-air"
APP_USER="depot"
SERVICE="depot-air"

# Warna
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}▸${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err() { echo -e "${RED}✗${NC} $*" >&2; }

# Pastikan run sebagai root
if [[ $EUID -ne 0 ]]; then
  err "Script ini harus dijalankan sebagai root (atau via sudo)."
  exit 1
fi

if [[ ! -d "$APP_DIR" ]]; then
  err "Folder $APP_DIR tidak ditemukan."
  exit 1
fi

cd "$APP_DIR"

# Helper: jalankan command sebagai user depot
run_as_user() {
  sudo -u "$APP_USER" -H bash -lc "cd $APP_DIR && $*"
}

# 1. Capture HEAD sebelum pull untuk diff
log "Pull kode terbaru dari GitHub..."
HEAD_BEFORE=$(run_as_user "git rev-parse HEAD")
run_as_user "git pull --ff-only"
HEAD_AFTER=$(run_as_user "git rev-parse HEAD")

if [[ "$HEAD_BEFORE" == "$HEAD_AFTER" ]]; then
  log "Sudah versi terbaru ($HEAD_AFTER). Skip build & restart."
  exit 0
fi

log "Update: $HEAD_BEFORE → $HEAD_AFTER"

# 2. Cek apakah package.json / lock berubah
NEED_INSTALL=$(run_as_user "git diff --name-only $HEAD_BEFORE $HEAD_AFTER -- package.json package-lock.json | head -1")
if [[ -n "$NEED_INSTALL" ]]; then
  log "package.json berubah → npm install..."
  run_as_user "npm install"
else
  log "Dependency tidak berubah, skip npm install."
fi

# 3. Build
log "npm run build..."
run_as_user "npm run build"

# 4. Always migrate (idempotent — drizzle-kit skip yang sudah applied).
# Lebih aman daripada cek diff: kalau build pertama gagal lalu commit fix
# kedua tanpa SQL baru, migrate tetap perlu jalan.
log "npm run db:migrate (idempotent)..."
run_as_user "npm run db:migrate"

# 5. Restart service
log "Restart $SERVICE..."
systemctl restart "$SERVICE"
sleep 2

# 6. Verifikasi
if systemctl is-active --quiet "$SERVICE"; then
  log "✓ $SERVICE running. Deploy selesai."
  echo
  echo "Cek log live: journalctl -u $SERVICE -f"
else
  err "$SERVICE TIDAK running setelah restart!"
  echo "Cek log: journalctl -u $SERVICE -n 50"
  exit 1
fi
