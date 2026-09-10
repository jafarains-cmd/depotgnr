#!/usr/bin/env bash
# Depot Air — provision tenant baru (Opsi 1: instance per depot).
#
# Setiap tenant dapat:
#   - Directory sendiri di /opt/depot-tenant-<slug>/
#   - Systemd service unique (depot-tenant-<slug>.service)
#   - Port unique (auto-detect free port mulai dari 3001)
#   - Database SQLite sendiri
#   - .env.local sendiri (WA key, Firebase, Drive folder per depot)
#   - Subdomain sendiri (butuh DNS + Cloudflare Tunnel manual — instruksi di akhir)
#
# Usage: sudo bash setup-tenant.sh <slug> "<Nama Depot>" <admin_email>
#   slug         : identifier lowercase pakai dash (mis. tirtaputra)
#   Nama Depot   : tampilan lengkap (mis. "Depot Tirtaputra Sejahtera")
#   admin_email  : email owner depot untuk akun admin pertama

set -euo pipefail

# ===== Argument parsing =====
if [[ $# -lt 3 ]]; then
  echo "Usage: sudo bash $0 <slug> \"<Nama Depot>\" <admin_email>"
  echo ""
  echo "Example:"
  echo "  sudo bash $0 tirtaputra \"Depot Tirtaputra Sejahtera\" owner@tirtaputra.com"
  exit 1
fi

SLUG="$1"
NAMA_DEPOT="$2"
ADMIN_EMAIL="$3"

# Validasi slug
if [[ ! "$SLUG" =~ ^[a-z][a-z0-9-]{2,30}$ ]]; then
  echo "ERROR: slug harus lowercase, mulai huruf, 3-30 char, hanya a-z 0-9 dash."
  echo "Contoh valid: tirtaputra, air-jaya, depot-abc"
  exit 1
fi

# Root check
if [[ $EUID -ne 0 ]]; then
  echo "ERROR: script harus jalan sebagai root (sudo)."
  exit 1
fi

TENANT_DIR="/opt/depot-tenant-${SLUG}"
SERVICE_NAME="depot-tenant-${SLUG}"
DB_PATH="${TENANT_DIR}/data/depot.db"
REPO_URL="https://github.com/jafarains-cmd/depotgnr.git"

# Warna
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}▸${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err() { echo -e "${RED}✗${NC} $*" >&2; }
info() { echo -e "${CYAN}ℹ${NC} $*"; }

# ===== Pre-flight checks =====

# Cek slug tidak duplicate
if [[ -d "$TENANT_DIR" ]]; then
  err "Tenant '${SLUG}' sudah ada di ${TENANT_DIR}."
  err "Kalau mau re-setup, hapus dulu: sudo bash scripts/remove-tenant.sh ${SLUG}"
  exit 1
fi

if systemctl list-unit-files --no-pager 2>/dev/null | grep -q "^${SERVICE_NAME}.service"; then
  err "Systemd service ${SERVICE_NAME} sudah ada. Hapus dulu."
  exit 1
fi

# Cek dependencies
for cmd in git node npm systemctl sudo; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    err "Command '$cmd' tidak ada. Install dulu."
    exit 1
  fi
done

# Cek user 'depot' (asumsi sudah ada dari main install)
if ! id depot >/dev/null 2>&1; then
  err "User 'depot' tidak ada. Buat dulu: sudo useradd -m -s /bin/bash depot"
  exit 1
fi

# ===== Allocate free port =====
allocate_port() {
  local start_port=3001
  local port=$start_port
  while ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":${port}\$"; do
    port=$((port + 1))
    if [[ $port -gt 3099 ]]; then
      err "Tidak ada port tersedia di range 3001-3099. Cek konflik manual."
      exit 1
    fi
  done
  echo "$port"
}

TENANT_PORT=$(allocate_port)
log "Port dialokasikan: ${TENANT_PORT}"

# ===== Clone repo =====
log "Clone repo dari GitHub..."
sudo -u depot -H bash -lc "git clone --depth 1 ${REPO_URL} ${TENANT_DIR}"

# ===== Generate secrets =====
log "Generate secrets..."
BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# ===== Create .env.local =====
log "Setup .env.local..."
sudo -u depot tee "${TENANT_DIR}/.env.local" > /dev/null <<EOF
# Depot tenant: ${NAMA_DEPOT} (${SLUG})
# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

# ===== Server =====
PORT=${TENANT_PORT}
NODE_ENV=production
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
BETTER_AUTH_URL=https://depot-${SLUG}.genster.my.id

# ===== WhatsApp API =====
# Isi setelah tenant subscribe Fonnte/Wablas mereka sendiri.
# Sementara kosong = tidak ada notif WA (log-only di server).
WHATSAPP_PROVIDER=fonnte
WHATSAPP_API_KEY=
WHATSAPP_API_URL=https://api.fonnte.com/send

# ===== Firebase Cloud Messaging =====
# Tenant provide service-account JSON path (kalau mau notif native APK).
# Kalau kosong → FCM disabled, cuma web push (unreliable di APK background).
FIREBASE_SERVICE_ACCOUNT_PATH=

# ===== VAPID (Web Push) =====
# Generate via: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:${ADMIN_EMAIL}

# ===== Google Apps Script (Drive uploader) =====
# Tenant deploy Apps Script mereka sendiri untuk upload KTP/bukti bayar.
APPS_SCRIPT_URL=
APPS_SCRIPT_TOKEN=

# ===== Google Maps (opsional) =====
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
EOF

chmod 600 "${TENANT_DIR}/.env.local"
chown depot:depot "${TENANT_DIR}/.env.local"

# ===== Install dependencies =====
log "npm install (2-3 menit)..."
sudo -u depot -H bash -lc "cd ${TENANT_DIR} && npm install --no-audit --no-fund --loglevel=error"

# ===== Build =====
log "npm run build (2-5 menit)..."
sudo -u depot -H bash -lc "cd ${TENANT_DIR} && npm run build"

# ===== Setup DB =====
log "Init database + migrate..."
mkdir -p "${TENANT_DIR}/data"
chown depot:depot "${TENANT_DIR}/data"
sudo -u depot -H bash -lc "cd ${TENANT_DIR} && npm run db:migrate"

# ===== Create systemd service =====
log "Setup systemd service..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Depot Air Minum — Tenant ${NAMA_DEPOT}
After=network.target

[Service]
Type=simple
User=depot
WorkingDirectory=${TENANT_DIR}
ExecStart=/usr/bin/npm start
Environment=NODE_ENV=production
Environment=PORT=${TENANT_PORT}
Environment=TZ=Asia/Makassar
Restart=always
RestartSec=5
StandardOutput=append:/var/log/${SERVICE_NAME}.log
StandardError=append:/var/log/${SERVICE_NAME}.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}" >/dev/null 2>&1
systemctl start "${SERVICE_NAME}"
sleep 3

# ===== Verify =====
if systemctl is-active --quiet "${SERVICE_NAME}"; then
  log "✓ Service ${SERVICE_NAME} running di port ${TENANT_PORT}"
else
  err "Service tidak start. Cek log: journalctl -u ${SERVICE_NAME} -n 50"
  exit 1
fi

# ===== Setup metadata untuk update-all script =====
sudo -u depot tee "${TENANT_DIR}/.tenant-meta.json" > /dev/null <<EOF
{
  "slug": "${SLUG}",
  "nama": "${NAMA_DEPOT}",
  "admin_email": "${ADMIN_EMAIL}",
  "port": ${TENANT_PORT},
  "subdomain": "depot-${SLUG}.genster.my.id",
  "service": "${SERVICE_NAME}",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# ===== Instructions untuk finalisasi =====
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✓ TENANT '${SLUG}' PROVISIONED SUCCESSFULLY${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Tenant info:"
echo "  Nama       : ${NAMA_DEPOT}"
echo "  Directory  : ${TENANT_DIR}"
echo "  Port       : ${TENANT_PORT}"
echo "  Service    : ${SERVICE_NAME}"
echo "  Log        : /var/log/${SERVICE_NAME}.log"
echo "  Subdomain  : depot-${SLUG}.genster.my.id (belum aktif — see step 1)"
echo ""
echo -e "${YELLOW}==== STEP MANUAL YG PERLU ANDA LAKUKAN ====${NC}"
echo ""
echo -e "${CYAN}1. Cloudflare Tunnel routing${NC}"
echo "   Login Cloudflare dashboard → Zero Trust → Tunnels → depot tunnel"
echo "   → Public Hostnames → Add hostname:"
echo "     - Subdomain : depot-${SLUG}"
echo "     - Domain    : genster.my.id"
echo "     - Service   : HTTP → localhost:${TENANT_PORT}"
echo ""
echo -e "${CYAN}2. Wait DNS propagation (30 detik - 2 menit)${NC}"
echo "   curl -sI https://depot-${SLUG}.genster.my.id"
echo ""
echo -e "${CYAN}3. Create admin user pertama untuk tenant${NC}"
echo "   cd ${TENANT_DIR}"
echo "   sudo -u depot npm run db:create-admin -- --email=${ADMIN_EMAIL}"
echo ""
echo -e "${CYAN}4. Kirim credential ke owner depot${NC}"
echo "   Login URL: https://depot-${SLUG}.genster.my.id/login"
echo "   Email    : ${ADMIN_EMAIL}"
echo "   Password : (dari step 3, atau kasih dia link reset password)"
echo ""
echo -e "${CYAN}5. (Optional) Build APK khusus tenant${NC}"
echo "   sudo bash scripts/tenant-setup/build-apk-for-tenant.sh ${SLUG}"
echo ""
echo -e "${CYAN}6. (Optional) Setup Fonnte + Firebase + Drive untuk tenant${NC}"
echo "   Edit ${TENANT_DIR}/.env.local, isi WHATSAPP_API_KEY dll"
echo "   sudo systemctl restart ${SERVICE_NAME}"
echo ""
echo "Untuk update semua tenants dari GitHub:"
echo "  sudo bash scripts/tenant-setup/update-all.sh"
echo ""
echo "Untuk list semua tenants:"
echo "  sudo bash scripts/tenant-setup/list-tenants.sh"
echo ""
