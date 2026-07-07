#!/bin/bash
# Rollback major update Depot Air ke tag backup.
#
# Usage: sudo bash /opt/depot-air/scripts/rollback-major.sh <backup-tag>
#        sudo bash /opt/depot-air/scripts/rollback-major.sh    # auto-detect terbaru

set -e

APP_DIR="/opt/depot-air"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

cd "$APP_DIR" || { echo -e "${RED}✗ Tidak bisa masuk $APP_DIR${NC}"; exit 1; }

# ═══════════════════════════════════════════════════════════
# TENTUKAN BACKUP TAG
# ═══════════════════════════════════════════════════════════

if [ -n "$1" ]; then
  BACKUP_TAG="$1"
else
  # Auto-detect: cari tag pre-major-update-* paling baru
  BACKUP_TAG=$(git tag -l "pre-major-update-*" | sort -r | head -1)
  if [ -z "$BACKUP_TAG" ]; then
    echo -e "${RED}✗ Tidak ada backup tag ditemukan.${NC}"
    echo -e "${YELLOW}List tag yang ada:${NC}"
    git tag -l
    echo ""
    echo "Usage: sudo bash $0 <backup-tag>"
    exit 1
  fi
  echo -e "${YELLOW}Auto-detected backup: $BACKUP_TAG${NC}"
fi

# Verify tag exists
if ! git rev-parse "$BACKUP_TAG" > /dev/null 2>&1; then
  echo -e "${RED}✗ Tag $BACKUP_TAG tidak ditemukan${NC}"
  exit 1
fi

TARGET_COMMIT=$(git rev-parse "$BACKUP_TAG")
CURRENT_COMMIT=$(git rev-parse HEAD)

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}  DEPOT AIR — ROLLBACK MAJOR UPDATE${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Backup tag  : $BACKUP_TAG"
echo "Target     : ${TARGET_COMMIT:0:8}"
echo "Current    : ${CURRENT_COMMIT:0:8}"
echo ""

# ═══════════════════════════════════════════════════════════
# WARNING
# ═══════════════════════════════════════════════════════════

echo -e "${YELLOW}${BOLD}⚠ PERHATIAN:${NC}"
echo "Rollback akan:"
echo "  1. Reset code ke commit sebelum update"
echo "  2. Hapus node_modules + .next"
echo "  3. Install ulang paket versi lama (npm ci)"
echo "  4. Rebuild + restart service"
echo ""
echo -e "${YELLOW}Perubahan uncommitted akan HILANG.${NC}"
echo ""

# Cek uncommitted
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}⚠ Ada perubahan uncommitted:${NC}"
  git status --short
  echo ""
fi

read -p "Yakin lanjut rollback? [y/N]: " ans
if [[ "$ans" != "y" ]]; then
  echo "Dibatalkan."
  exit 0
fi

# ═══════════════════════════════════════════════════════════
# STOP SERVICE
# ═══════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}▸ Stop depot-air service...${NC}"
systemctl stop depot-air.service || true
echo -e "${GREEN}✓${NC}"

# ═══════════════════════════════════════════════════════════
# RESET CODE
# ═══════════════════════════════════════════════════════════

echo -e "${BOLD}▸ Git reset ke $BACKUP_TAG...${NC}"
git reset --hard "$BACKUP_TAG"
echo -e "${GREEN}✓ HEAD sekarang @ ${TARGET_COMMIT:0:8}${NC}"

# ═══════════════════════════════════════════════════════════
# CLEAN + REINSTALL
# ═══════════════════════════════════════════════════════════

echo -e "${BOLD}▸ Hapus node_modules + .next...${NC}"
rm -rf node_modules .next
echo -e "${GREEN}✓${NC}"

echo -e "${BOLD}▸ npm ci (install dari lock file lama)...${NC}"
npm ci
echo -e "${GREEN}✓${NC}"

# ═══════════════════════════════════════════════════════════
# REBUILD
# ═══════════════════════════════════════════════════════════

echo -e "${BOLD}▸ Rebuild...${NC}"
if npm run build; then
  echo -e "${GREEN}✓ Build sukses${NC}"
else
  echo -e "${RED}✗ Build gagal setelah rollback!${NC}"
  echo -e "${YELLOW}Coba manual: npm run build${NC}"
  echo -e "${YELLOW}Atau restore DB backup + reinstall dari nol${NC}"
  exit 1
fi

# ═══════════════════════════════════════════════════════════
# RESTART SERVICE
# ═══════════════════════════════════════════════════════════

echo -e "${BOLD}▸ Restart service...${NC}"
systemctl start depot-air.service
sleep 3

if systemctl is-active depot-air.service > /dev/null; then
  echo -e "${GREEN}✓ Service running${NC}"
else
  echo -e "${RED}✗ Service tidak start${NC}"
  echo -e "${YELLOW}Cek log:${NC}"
  echo "  journalctl -u depot-air.service -n 50"
  exit 1
fi

# ═══════════════════════════════════════════════════════════
# VERIFY
# ═══════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}▸ Verify endpoint...${NC}"
if curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/api/health | grep -q "200"; then
  echo -e "${GREEN}✓ Health check OK${NC}"
else
  echo -e "${YELLOW}⚠ Health check tidak 200 — bisa jadi masih startup${NC}"
  echo -e "${YELLOW}  Tunggu 30 detik dan cek https://depot.genster.my.id${NC}"
fi

echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  ROLLBACK SELESAI${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Aplikasi sudah kembali ke state sebelum major update ($BACKUP_TAG)."
echo ""
echo -e "${YELLOW}Test manual di browser:${NC}"
echo "  https://depot.genster.my.id"
echo "  https://depot.genster.my.id/admin/security"
echo ""
echo -e "${YELLOW}Kalau butuh restore DB juga (data corrupt):${NC}"
echo "  systemctl stop depot-air.service"
echo "  cp /root/depot-backup-YYYY-MM-DD-HHMM.db /opt/depot-air/data/depot.db"
echo "  systemctl start depot-air.service"
