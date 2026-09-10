#!/usr/bin/env bash
# Depot Air — trigger GH Actions build APK khusus untuk 1 tenant.
#
# Butuh:
#   - gh CLI installed + authenticated (`gh auth login`)
#   - Tenant slug sudah di-setup di server (setup-tenant.sh)
#
# Usage:
#   bash build-apk-for-tenant.sh <slug> [debug|release] ["Nama Depot"]
#
# Contoh:
#   bash build-apk-for-tenant.sh tirtaputra release "Depot Tirtaputra Sejahtera"

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash $0 <slug> [debug|release] [\"Nama Depot\"]"
  echo ""
  echo "Contoh:"
  echo "  bash $0 tirtaputra debug"
  echo "  bash $0 tirtaputra release \"Depot Tirtaputra Sejahtera\""
  exit 1
fi

SLUG="$1"
BUILD_TYPE="${2:-debug}"
TENANT_NAME="${3:-}"
REPO="jafarains-cmd/depotgnr"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}▸${NC} $*"; }
info() { echo -e "${CYAN}ℹ${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }

# Cek gh CLI
if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI belum installed. Install dari https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh CLI belum login. Jalankan: gh auth login"
  exit 1
fi

# Validate slug
if [[ ! "$SLUG" =~ ^[a-z][a-z0-9-]{2,30}$ ]]; then
  echo "ERROR: slug harus lowercase, 3-30 char, a-z 0-9 dash"
  exit 1
fi

# Validate build type
if [[ "$BUILD_TYPE" != "debug" && "$BUILD_TYPE" != "release" ]]; then
  echo "ERROR: build_type harus 'debug' atau 'release'"
  exit 1
fi

# Trigger workflow
log "Trigger GH Actions build untuk tenant '${SLUG}' (${BUILD_TYPE})..."

ARGS=(-f "build_type=${BUILD_TYPE}" -f "tenant_slug=${SLUG}")
if [[ -n "$TENANT_NAME" ]]; then
  ARGS+=(-f "tenant_name=${TENANT_NAME}")
fi

gh workflow run build-android-apk.yml -R "$REPO" --ref main "${ARGS[@]}"

# Wait 5 detik supaya run muncul di list
sleep 5

# Ambil run ID terbaru
RUN_ID=$(gh run list --workflow=build-android-apk.yml -R "$REPO" --limit 1 --json databaseId --jq '.[0].databaseId')

if [[ -z "$RUN_ID" ]]; then
  warn "Tidak bisa detect run ID. Cek manual di https://github.com/${REPO}/actions"
  exit 0
fi

log "Run started: https://github.com/${REPO}/actions/runs/${RUN_ID}"
info "Menunggu build selesai (biasa 3-5 menit)..."

# Watch (blocking)
if gh run watch "$RUN_ID" -R "$REPO" --exit-status; then
  log "✓ Build sukses!"

  # Download artifact ke Downloads
  DOWNLOAD_DIR="${HOME}/Downloads/depot-apk"
  mkdir -p "$DOWNLOAD_DIR"

  log "Download APK ke ${DOWNLOAD_DIR}..."
  gh run download "$RUN_ID" -R "$REPO" --dir "$DOWNLOAD_DIR"

  # Find newest APK for this tenant
  APK_FILE=$(find "$DOWNLOAD_DIR" -name "depot-${SLUG}-*.apk" -newer /tmp -printf '%T+ %p\n' 2>/dev/null | sort -r | head -1 | cut -d' ' -f2)
  if [[ -n "$APK_FILE" ]]; then
    log "APK ready: $APK_FILE"
    echo ""
    info "Distribusi ke owner depot:"
    echo "  1. Kirim file APK via WA / Drive / link download"
    echo "  2. Owner install: buka file → tap Install → Allow from source"
    echo "  3. First launch: login pakai email + password admin depot"
  fi
else
  echo "ERROR: Build gagal. Cek log di https://github.com/${REPO}/actions/runs/${RUN_ID}"
  exit 1
fi
