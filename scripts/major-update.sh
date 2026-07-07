#!/bin/bash
# Major update dependencies untuk Depot Air.
# Terstruktur per stage dengan checkpoint + rollback plan.
#
# Usage: sudo bash /opt/depot-air/scripts/major-update.sh
#
# Setiap stage:
#   1. Update paket
#   2. Test build
#   3. Prompt konfirmasi lanjut / stop / rollback

set -e

APP_DIR="/opt/depot-air"
BACKUP_DIR="/root"
TIMESTAMP=$(date +%Y-%m-%d-%H%M)
BACKUP_TAG="pre-major-update-$TIMESTAMP"
DB_BACKUP="$BACKUP_DIR/depot-backup-$TIMESTAMP.db"
ENV_BACKUP="$BACKUP_DIR/depot-env-$TIMESTAMP.backup"

# Warna terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

cd "$APP_DIR" || { echo -e "${RED}✗ Tidak bisa masuk $APP_DIR${NC}"; exit 1; }

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}  DEPOT AIR — MAJOR UPDATE DEPENDENCIES${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Waktu: $(date)"
echo "Backup tag: $BACKUP_TAG"
echo ""

# ═══════════════════════════════════════════════════════════
# PRE-FLIGHT CHECK
# ═══════════════════════════════════════════════════════════

echo -e "${BOLD}▸ Pre-flight check...${NC}"

# Cek working tree bersih
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}✗ Working tree ada perubahan uncommitted:${NC}"
  git status --short
  echo ""
  echo -e "${YELLOW}Commit atau stash dulu sebelum major update.${NC}"
  exit 1
fi

# Cek Node & npm
NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo "  Node: $NODE_VER"
echo "  npm : $NPM_VER"

# Cek disk space (butuh min 500MB)
DISK_FREE=$(df -m . | tail -1 | awk '{print $4}')
echo "  Disk free: ${DISK_FREE}MB"
if [ "$DISK_FREE" -lt 500 ]; then
  echo -e "${YELLOW}⚠ Disk < 500MB — bisa gagal saat install package baru${NC}"
  read -p "Lanjut? [y/N]: " ans
  [[ "$ans" != "y" ]] && exit 1
fi

echo ""

# ═══════════════════════════════════════════════════════════
# BACKUP
# ═══════════════════════════════════════════════════════════

echo -e "${BOLD}▸ Backup sebelum update...${NC}"

# 1. Git tag
git tag "$BACKUP_TAG"
CURRENT_COMMIT=$(git rev-parse HEAD)
echo -e "  ${GREEN}✓${NC} Git tag: $BACKUP_TAG @ ${CURRENT_COMMIT:0:8}"

# 2. Database backup
if [ -f "$APP_DIR/data/depot.db" ]; then
  cp "$APP_DIR/data/depot.db" "$DB_BACKUP"
  DB_SIZE=$(du -h "$DB_BACKUP" | cut -f1)
  echo -e "  ${GREEN}✓${NC} DB: $DB_BACKUP ($DB_SIZE)"
else
  echo -e "  ${YELLOW}⚠${NC} DB tidak ditemukan di $APP_DIR/data/depot.db"
fi

# 3. Env backup
if [ -f "$APP_DIR/.env.local" ]; then
  cp "$APP_DIR/.env.local" "$ENV_BACKUP"
  echo -e "  ${GREEN}✓${NC} Env: $ENV_BACKUP"
fi

# 4. Snapshot package.json + lock
cp "$APP_DIR/package.json" "$BACKUP_DIR/package-$TIMESTAMP.json"
cp "$APP_DIR/package-lock.json" "$BACKUP_DIR/package-lock-$TIMESTAMP.json"
echo -e "  ${GREEN}✓${NC} package.json & lock disimpan"

echo ""

# ═══════════════════════════════════════════════════════════
# HELPER FUNCTION
# ═══════════════════════════════════════════════════════════

confirm_stage() {
  local stage_name="$1"
  echo ""
  echo -e "${BOLD}${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${YELLOW}  Stage berikut: $stage_name${NC}"
  echo -e "${BOLD}${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  read -p "Lanjut? [y]es / [n]o (stop di sini) / [q]uit + rollback: " ans
  case "$ans" in
    y|Y) return 0 ;;
    q|Q)
      echo -e "${RED}▸ Rollback…${NC}"
      rollback_all
      exit 0
      ;;
    *)
      echo -e "${YELLOW}▸ Stop di stage sebelumnya.${NC}"
      echo -e "${YELLOW}▸ Kalau mau rollback total: sudo bash $APP_DIR/scripts/rollback-major.sh $BACKUP_TAG${NC}"
      exit 0
      ;;
  esac
}

test_build() {
  echo -e "${BOLD}▸ Test build…${NC}"
  if npm run build 2>&1 | tee /tmp/depot-build.log | tail -20; then
    if grep -q "Compiled successfully" /tmp/depot-build.log; then
      echo -e "${GREEN}✓ Build sukses${NC}"
      return 0
    fi
  fi
  echo -e "${RED}✗ Build GAGAL — cek log di /tmp/depot-build.log${NC}"
  echo -e "${YELLOW}Rollback: sudo bash $APP_DIR/scripts/rollback-major.sh $BACKUP_TAG${NC}"
  return 1
}

rollback_all() {
  echo ""
  echo -e "${BOLD}${RED}━━━ ROLLBACK ━━━${NC}"
  git reset --hard "$BACKUP_TAG"
  rm -rf node_modules .next
  npm ci
  npm run build || echo -e "${YELLOW}⚠ Build gagal — cek manual${NC}"
  systemctl restart depot-air.service
  echo -e "${GREEN}✓ Rollback selesai${NC}"
}

# ═══════════════════════════════════════════════════════════
# STAGE 1: AUTO-FIX AMAN (better-auth patch)
# ═══════════════════════════════════════════════════════════

confirm_stage "STAGE 1 — Auto-fix aman (better-auth patch)"

echo -e "${BOLD}▸ npm audit fix (tanpa --force)…${NC}"
npm audit fix || true   # exit code non-zero saat masih ada vuln — normal

if ! test_build; then
  echo -e "${RED}Stage 1 gagal build. Rollback disarankan.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Stage 1 selesai${NC}"

# ═══════════════════════════════════════════════════════════
# STAGE 2: DRIZZLE-KIT + ESBUILD-KIT CHAIN
# ═══════════════════════════════════════════════════════════

confirm_stage "STAGE 2 — Update drizzle-kit + chain (esbuild-kit, esbuild)"

echo -e "${BOLD}▸ Update drizzle-kit ke latest…${NC}"
npm install --save-dev drizzle-kit@latest

echo -e "${BOLD}▸ Cek breaking changes drizzle.config.ts…${NC}"
if [ -f drizzle.config.ts ]; then
  echo -e "  Config lama:"
  cat drizzle.config.ts | head -20
  echo ""
  echo -e "${YELLOW}Kalau drizzle-kit versi baru butuh migration, cek:${NC}"
  echo -e "${YELLOW}  https://orm.drizzle.team/docs/kit-overview${NC}"
  echo ""
  read -p "Config kompatibel? [y]es / [n]o + rollback stage: " ans
  if [[ "$ans" != "y" ]]; then
    git checkout package.json package-lock.json
    npm ci
    echo -e "${YELLOW}Stage 2 di-cancel.${NC}"
    exit 0
  fi
fi

echo -e "${BOLD}▸ Test db:migrate…${NC}"
npm run db:migrate || {
  echo -e "${RED}✗ db:migrate gagal${NC}"
  echo -e "${YELLOW}Rollback stage: git checkout package.json package-lock.json && npm ci${NC}"
  exit 1
}

if ! test_build; then exit 1; fi

echo -e "${GREEN}✓ Stage 2 selesai${NC}"

# ═══════════════════════════════════════════════════════════
# STAGE 3: NEXT MAJOR UPDATE
# ═══════════════════════════════════════════════════════════

confirm_stage "STAGE 3 — Next.js major update (PALING RISKY)"

CURRENT_NEXT=$(node -e "console.log(require('./package.json').dependencies.next)")
echo -e "  Current Next: $CURRENT_NEXT"

# Cek latest stable Next di npm
LATEST_NEXT=$(npm view next version)
echo -e "  Latest Next: $LATEST_NEXT"

echo ""
echo -e "${YELLOW}Baca release notes Next.js dulu:${NC}"
echo -e "${YELLOW}  https://nextjs.org/blog${NC}"
echo -e "${YELLOW}  https://github.com/vercel/next.js/releases${NC}"
echo ""

read -p "Sudah baca changelog + tidak ada breaking change untuk DEPOT? [y/N]: " ans
if [[ "$ans" != "y" ]]; then
  echo -e "${YELLOW}Stage 3 di-skip — Next tetap di $CURRENT_NEXT.${NC}"
  echo -e "${GREEN}✓ Major update selesai (Stage 1-2 saja).${NC}"
  exit 0
fi

echo -e "${BOLD}▸ Update next + react + react-dom…${NC}"
npm install next@latest react@latest react-dom@latest

echo -e "${BOLD}▸ Update eslint-config-next kalau ada…${NC}"
if grep -q "eslint-config-next" package.json; then
  npm install --save-dev eslint-config-next@latest
fi

if ! test_build; then
  echo -e "${RED}Next update gagal build. Rollback stage:${NC}"
  echo -e "${YELLOW}  git checkout package.json package-lock.json && npm ci${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Stage 3 selesai${NC}"

# ═══════════════════════════════════════════════════════════
# COMMIT + DEPLOY
# ═══════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}  SEMUA STAGE SELESAI${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

git diff --stat package.json package-lock.json | head -10

echo ""
read -p "Commit + deploy sekarang? [y/N]: " ans
if [[ "$ans" == "y" ]]; then
  git add package.json package-lock.json
  git commit -m "chore(deps): major update $TIMESTAMP

Backup tag: $BACKUP_TAG
Rollback: sudo bash scripts/rollback-major.sh $BACKUP_TAG"

  # Push kalau ada remote
  if git remote get-url origin > /dev/null 2>&1; then
    read -p "Push ke GitHub? [y/N]: " push_ans
    [[ "$push_ans" == "y" ]] && git push origin main
  fi

  # Restart service
  systemctl restart depot-air.service
  sleep 3
  systemctl is-active depot-air.service > /dev/null && \
    echo -e "${GREEN}✓ Service running${NC}" || \
    echo -e "${RED}✗ Service tidak start — cek: journalctl -u depot-air.service -n 30${NC}"
fi

echo ""
echo -e "${BOLD}${GREEN}Backup tersimpan:${NC}"
echo "  Git tag  : $BACKUP_TAG"
echo "  DB       : $DB_BACKUP"
echo "  Env      : $ENV_BACKUP"
echo "  Packages : $BACKUP_DIR/package-$TIMESTAMP.json"
echo ""
echo -e "${YELLOW}Kalau ada masalah tersembunyi, rollback dengan:${NC}"
echo -e "${YELLOW}  sudo bash $APP_DIR/scripts/rollback-major.sh $BACKUP_TAG${NC}"
echo ""
echo -e "${GREEN}Sekarang test manual: buka https://depot.genster.my.id${NC}"
