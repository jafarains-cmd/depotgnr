#!/usr/bin/env bash
# Depot Air — hapus tenant (dengan backup DB automatic).
#
# Yang dilakukan:
#   1. Backup DB tenant ke /var/backups/depot-tenants/<slug>-<timestamp>.db.gz
#   2. Backup .env.local ke same folder
#   3. Stop + disable + hapus systemd service
#   4. Hapus tenant directory /opt/depot-tenant-<slug>/
#
# Aman: backup diambil DULU sebelum destroy. Kalau backup gagal, script exit.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: sudo bash $0 <slug>"
  echo "Example: sudo bash $0 tirtaputra"
  exit 1
fi

SLUG="$1"

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: script harus jalan sebagai root (sudo)."
  exit 1
fi

TENANT_DIR="/opt/depot-tenant-${SLUG}"
SERVICE_NAME="depot-tenant-${SLUG}"
BACKUP_DIR="/var/backups/depot-tenants"
TS=$(date +%Y%m%d-%H%M%S)

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

if [[ ! -d "$TENANT_DIR" ]]; then
  echo -e "${RED}✗${NC} Tenant '${SLUG}' tidak ditemukan (${TENANT_DIR})"
  exit 1
fi

# ===== Confirmation =====
echo -e "${YELLOW}⚠  KONFIRMASI: Hapus tenant '${SLUG}'?${NC}"
echo "  Directory : ${TENANT_DIR}"
echo "  Service   : ${SERVICE_NAME}"
echo "  Backup ke : ${BACKUP_DIR}/${SLUG}-${TS}.tar.gz"
echo ""
read -r -p "Ketik nama tenant persis untuk konfirmasi ('${SLUG}'): " CONFIRM
if [[ "$CONFIRM" != "$SLUG" ]]; then
  echo "Batal."
  exit 1
fi

# ===== Backup =====
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}▸${NC} Backup DB + .env.local..."

if [[ -f "${TENANT_DIR}/data/depot.db" ]]; then
  # SQLite backup command (safe untuk WAL mode)
  sudo -u depot sqlite3 "${TENANT_DIR}/data/depot.db" ".backup /tmp/${SLUG}-db-${TS}.db"
  gzip "/tmp/${SLUG}-db-${TS}.db"
  mv "/tmp/${SLUG}-db-${TS}.db.gz" "${BACKUP_DIR}/"
fi

# .env.local + metadata
if [[ -f "${TENANT_DIR}/.env.local" ]]; then
  cp "${TENANT_DIR}/.env.local" "${BACKUP_DIR}/${SLUG}-env-${TS}.local"
fi
if [[ -f "${TENANT_DIR}/.tenant-meta.json" ]]; then
  cp "${TENANT_DIR}/.tenant-meta.json" "${BACKUP_DIR}/${SLUG}-meta-${TS}.json"
fi

echo -e "${GREEN}✓${NC} Backup selesai di ${BACKUP_DIR}/"

# ===== Stop + remove service =====
echo -e "${GREEN}▸${NC} Stop service ${SERVICE_NAME}..."
systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload

# ===== Remove directory =====
echo -e "${GREEN}▸${NC} Hapus directory ${TENANT_DIR}..."
rm -rf "${TENANT_DIR}"

# ===== Remove log (kalau ada) =====
if [[ -f "/var/log/${SERVICE_NAME}.log" ]]; then
  gzip "/var/log/${SERVICE_NAME}.log" 2>/dev/null || true
  mv "/var/log/${SERVICE_NAME}.log.gz" "${BACKUP_DIR}/" 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✓ TENANT '${SLUG}' DIHAPUS${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Backup tersimpan di: ${BACKUP_DIR}/"
echo "  - ${SLUG}-db-${TS}.db.gz"
echo "  - ${SLUG}-env-${TS}.local"
echo "  - ${SLUG}-meta-${TS}.json (kalau ada)"
echo ""
echo -e "${YELLOW}⚠  JANGAN LUPA:${NC}"
echo "  1. Hapus juga hostname di Cloudflare Tunnel dashboard"
echo "     (Zero Trust → Tunnels → Public Hostnames → depot-${SLUG})"
echo "  2. Kalau ada APK khusus tenant, kabari user untuk uninstall"
echo ""
echo "Kalau nanti mau restore tenant ini kembali:"
echo "  1. Bikin ulang: sudo bash setup-tenant.sh ${SLUG} \"...\" ..."
echo "  2. Restore DB: gunzip -c ${BACKUP_DIR}/${SLUG}-db-${TS}.db.gz > /opt/depot-tenant-${SLUG}/data/depot.db"
