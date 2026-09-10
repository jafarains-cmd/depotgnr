#!/usr/bin/env bash
# Depot Air — update SEMUA tenant dari GitHub.
#
# Loop through:
#   /opt/depot-air/                  (main depot GNR — jaga backward compat)
#   /opt/depot-tenant-*/             (semua tenant Opsi 1)
#
# Untuk masing-masing:
#   1. git pull --ff-only sebagai user 'depot'
#   2. npm install kalau package.json/lock berubah sejak build terakhir
#   3. Force build kalau .next/BUILD_ID hilang atau BUILD_COMMIT != HEAD
#   4. Run drizzle migrate (idempotent)
#   5. systemctl restart service
#
# Aman: setiap tenant proceed independen, fail 1 tidak stop yang lain.
# Ringkasan final tampil status per-tenant.

set -uo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}▸${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err() { echo -e "${RED}✗${NC} $*" >&2; }
section() { echo -e "\n${CYAN}=== $* ===${NC}"; }

if [[ $EUID -ne 0 ]]; then
  err "Script ini harus jalan sebagai root (sudo)."
  exit 1
fi

# ===== Collect all tenants =====
declare -a TENANTS
if [[ -d "/opt/depot-air" ]]; then
  TENANTS+=("/opt/depot-air")
fi
for dir in /opt/depot-tenant-*/; do
  [[ -d "$dir" ]] && TENANTS+=("${dir%/}")
done

if [[ ${#TENANTS[@]} -eq 0 ]]; then
  err "Tidak ada tenant terdeteksi (/opt/depot-air/ atau /opt/depot-tenant-*/)."
  exit 1
fi

log "Menemukan ${#TENANTS[@]} tenant untuk di-update:"
for t in "${TENANTS[@]}"; do
  echo "  - $t"
done
echo ""

# ===== Update function per-tenant =====
declare -A RESULTS

update_tenant() {
  local dir="$1"
  local slug
  slug=$(basename "$dir" | sed 's/^depot-tenant-//; s/^depot-air$/gnr-main/')

  # Detect service name
  local service
  if [[ "$dir" == "/opt/depot-air" ]]; then
    service="depot-air"
  else
    service="depot-tenant-${slug}"
  fi

  section "UPDATE: $slug ($dir)"

  # Reset dirty package-lock (kalau ada) supaya pull tidak conflict
  sudo -u depot bash -lc "cd $dir && git checkout -- package-lock.json 2>/dev/null || true"

  # Read BUILD_COMMIT marker (kalau ada)
  local last_built=""
  if [[ -f "$dir/.next/BUILD_COMMIT" ]]; then
    last_built=$(cat "$dir/.next/BUILD_COMMIT" | tr -d '[:space:]')
  fi

  # Git pull
  log "Pull dari GitHub..."
  if ! sudo -u depot bash -lc "cd $dir && git pull --ff-only" 2>&1 | tail -5; then
    err "Git pull GAGAL untuk $slug"
    RESULTS[$slug]="FAIL: git pull"
    return
  fi

  local head_now
  head_now=$(sudo -u depot bash -lc "cd $dir && git rev-parse HEAD")

  # Bootstrap BUILD_COMMIT kalau BUILD_ID ada tapi marker belum ada
  if [[ -f "$dir/.next/BUILD_ID" && -z "$last_built" ]]; then
    warn "Bootstrap BUILD_COMMIT = HEAD"
    echo "$head_now" > "$dir/.next/BUILD_COMMIT"
    chown depot:depot "$dir/.next/BUILD_COMMIT"
    last_built="$head_now"
  fi

  # Skip kalau up-to-date
  if [[ -f "$dir/.next/BUILD_ID" && "$last_built" == "$head_now" ]]; then
    log "Build up-to-date. Skip build."
    sudo -u depot bash -lc "cd $dir && npm run db:migrate" >/dev/null 2>&1 || true
    RESULTS[$slug]="OK (skip build)"
    return
  fi

  # Determine npm install perlu
  local need_install=""
  if [[ -z "$last_built" ]]; then
    warn "First run, npm install untuk safety"
    need_install="yes"
  else
    need_install=$(sudo -u depot bash -lc "cd $dir && git diff --name-only $last_built $head_now -- package.json package-lock.json 2>/dev/null | head -1" || true)
  fi

  if [[ -n "$need_install" ]]; then
    log "package.json berubah → npm install..."
    if ! sudo -u depot bash -lc "cd $dir && npm install --no-audit --no-fund --loglevel=error" 2>&1 | tail -3; then
      err "npm install GAGAL untuk $slug"
      RESULTS[$slug]="FAIL: npm install"
      return
    fi
  fi

  # Rebuild
  if [[ ! -f "$dir/.next/BUILD_ID" ]]; then
    sudo -u depot bash -lc "cd $dir && rm -rf .next"
  fi
  log "npm run build..."
  if ! sudo -u depot bash -lc "cd $dir && npm run build" 2>&1 | tail -3; then
    err "Build GAGAL untuk $slug"
    RESULTS[$slug]="FAIL: build"
    return
  fi

  # Marker
  echo "$head_now" > "$dir/.next/BUILD_COMMIT"
  chown depot:depot "$dir/.next/BUILD_COMMIT"

  # Migrate
  log "npm run db:migrate..."
  sudo -u depot bash -lc "cd $dir && npm run db:migrate" >/dev/null 2>&1 || warn "Migrate error (continuing)"

  # Restart service
  log "Restart $service..."
  systemctl restart "$service"
  sleep 2

  if systemctl is-active --quiet "$service"; then
    RESULTS[$slug]="OK (rebuilt)"
    log "✓ $service running"
  else
    err "$service TIDAK running setelah restart!"
    RESULTS[$slug]="FAIL: service down"
  fi
}

# ===== Run for all =====
for tenant_dir in "${TENANTS[@]}"; do
  update_tenant "$tenant_dir" || true
done

# ===== Summary =====
echo ""
section "SUMMARY"
declare -i ok_count=0
declare -i fail_count=0
for slug in "${!RESULTS[@]}"; do
  status="${RESULTS[$slug]}"
  if [[ "$status" == OK* ]]; then
    echo -e "  ${GREEN}✓${NC} $slug: $status"
    ok_count=$((ok_count + 1))
  else
    echo -e "  ${RED}✗${NC} $slug: $status"
    fail_count=$((fail_count + 1))
  fi
done
echo ""
echo -e "Total: ${GREEN}${ok_count} OK${NC}, ${RED}${fail_count} FAIL${NC}"

if [[ $fail_count -gt 0 ]]; then
  echo ""
  warn "Ada tenant FAIL. Cek log tenant tersebut untuk diagnose:"
  echo "  journalctl -u depot-tenant-<slug> -n 100"
  exit 1
fi
