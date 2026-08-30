#!/usr/bin/env bash
# Depot Air — one-shot update script.
# Run sebagai root: sudo /opt/depot-air/scripts/update.sh
#
# Yang dilakukan:
#   1. git pull sebagai user depot (cegah dubious-ownership)
#   2. npm install kalau package.json/lock berubah SEJAK LAST SUCCESSFUL BUILD
#   3. npm run build kalau BUILD_COMMIT != HEAD (bukan cuma "git pull ada perubahan")
#   4. drizzle migrate
#   5. systemctl restart depot-air
#
# Backfill / db:seed / db:create-admin TIDAK dijalankan otomatis — itu
# operasi sekali pakai, panggil manual sesuai kebutuhan.
#
# NOTE: dibanding versi lama, script ini pakai .next/BUILD_COMMIT sebagai
# ground truth "commit apa yg terakhir sukses di-build". Fix bug lama:
# kalau ada auto-pull di luar script (misal cron/webhook), git pull di dalam
# script return "already up to date" tapi .next masih dari build lama, script
# lama skip build → server serve kode stale. Sekarang membandingkan
# BUILD_COMMIT vs HEAD, bukan HEAD_BEFORE vs HEAD_AFTER.

set -euo pipefail

APP_DIR="/opt/depot-air"
APP_USER="depot"
SERVICE="depot-air"
BUILD_COMMIT_FILE="$APP_DIR/.next/BUILD_COMMIT"

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

# Marker commit dari build terakhir yang sukses. Empty string kalau belum
# pernah build via script versi ini (misal migrate dari script lama).
LAST_BUILT_COMMIT=""
if [[ -f "$BUILD_COMMIT_FILE" ]]; then
  LAST_BUILT_COMMIT=$(cat "$BUILD_COMMIT_FILE" | tr -d '[:space:]')
fi

# 1. Git pull
log "Pull kode terbaru dari GitHub..."
run_as_user "git pull --ff-only"
HEAD_NOW=$(run_as_user "git rev-parse HEAD")

log "Commit saat ini: $HEAD_NOW"
if [[ -n "$LAST_BUILT_COMMIT" ]]; then
  log "Build terakhir dari commit: $LAST_BUILT_COMMIT"
else
  warn "Belum ada BUILD_COMMIT marker (first run script versi baru)."
fi

# Cek apakah build up-to-date. Kondisi build match:
# - .next/BUILD_ID exists (Next.js write ini paling akhir → marker build selesai)
# - .next/BUILD_COMMIT exists dan == HEAD_NOW
#
# Bootstrap: kalau ada BUILD_ID tapi BUILD_COMMIT belum ada (migrate dari
# script lama), asumsi current build match dengan HEAD → tulis marker,
# skip build. Ini bikin transisi mulus dari script lama tanpa force rebuild
# yang tidak perlu.
if [[ -f "$APP_DIR/.next/BUILD_ID" && -z "$LAST_BUILT_COMMIT" ]]; then
  warn "Bootstrap BUILD_COMMIT = HEAD (assume current build match HEAD)."
  echo "$HEAD_NOW" > "$BUILD_COMMIT_FILE"
  chown "$APP_USER:$APP_USER" "$BUILD_COMMIT_FILE"
  LAST_BUILT_COMMIT="$HEAD_NOW"
fi

if [[ -f "$APP_DIR/.next/BUILD_ID" && "$LAST_BUILT_COMMIT" == "$HEAD_NOW" ]]; then
  log "Build sudah up-to-date dengan HEAD. Skip build."
  log "Run db:migrate sebagai safety net..."
  run_as_user "npm run db:migrate" || true
  exit 0
fi

# Perlu (re)build. Tentukan apakah perlu npm install juga.
NEED_INSTALL=""
if [[ -z "$LAST_BUILT_COMMIT" || "$LAST_BUILT_COMMIT" == "$HEAD_NOW" ]]; then
  # Marker belum ada / sama — cek changed files sejak build terakhir tidak
  # bisa, mainkan aman: skip install (kalau memang perlu, build akan fail
  # dan next run detect BUILD_ID missing → retry).
  warn "BUILD_COMMIT bootstrap / sama HEAD, skip install check."
else
  NEED_INSTALL=$(run_as_user "git diff --name-only $LAST_BUILT_COMMIT $HEAD_NOW -- package.json package-lock.json | head -1")
fi

if [[ -n "$NEED_INSTALL" ]]; then
  log "package.json / lock berubah → npm install..."
  run_as_user "npm install --no-audit --no-fund"
else
  log "Dependency tidak berubah, skip npm install."
fi

# Rebuild
if [[ ! -f "$APP_DIR/.next/BUILD_ID" ]]; then
  warn ".next/BUILD_ID hilang — clean build."
  run_as_user "rm -rf .next"
fi
log "npm run build..."
run_as_user "npm run build"

# Tulis marker commit yang barusan di-build. Ini yang ground-truth bakal
# di-baca run berikutnya.
echo "$HEAD_NOW" > "$BUILD_COMMIT_FILE"
chown "$APP_USER:$APP_USER" "$BUILD_COMMIT_FILE"
log "BUILD_COMMIT marker updated: $HEAD_NOW"

# Migrate (idempotent — drizzle-kit skip yang sudah applied)
log "npm run db:migrate..."
run_as_user "npm run db:migrate"

# Restart service
log "Restart $SERVICE..."
systemctl restart "$SERVICE"
sleep 2

if systemctl is-active --quiet "$SERVICE"; then
  log "✓ $SERVICE running. Deploy selesai."
  echo
  echo "Cek log live: journalctl -u $SERVICE -f"
else
  err "$SERVICE TIDAK running setelah restart!"
  echo "Cek log: journalctl -u $SERVICE -n 50"
  exit 1
fi
