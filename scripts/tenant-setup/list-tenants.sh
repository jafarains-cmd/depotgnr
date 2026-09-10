#!/usr/bin/env bash
# Depot Air — list semua tenant + status ringkas.
# Output: slug, port, service status, HEAD commit, disk usage, uptime service.

set -uo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

if [[ $EUID -ne 0 ]]; then
  echo "Script ini harus jalan sebagai root (sudo)."
  exit 1
fi

# Collect all tenants
declare -a TENANTS
[[ -d "/opt/depot-air" ]] && TENANTS+=("/opt/depot-air")
for dir in /opt/depot-tenant-*/; do
  [[ -d "$dir" ]] && TENANTS+=("${dir%/}")
done

if [[ ${#TENANTS[@]} -eq 0 ]]; then
  echo "Tidak ada tenant terdeteksi."
  exit 0
fi

echo -e "${CYAN}=== DEPOT AIR — TENANT STATUS ===${NC}"
echo ""
printf "%-20s %-8s %-10s %-10s %-8s %s\n" \
  "SLUG" "PORT" "STATUS" "SIZE" "UPTIME" "HEAD"
printf "%-20s %-8s %-10s %-10s %-8s %s\n" \
  "----" "----" "------" "----" "------" "----"

for dir in "${TENANTS[@]}"; do
  # Slug + service name
  if [[ "$dir" == "/opt/depot-air" ]]; then
    slug="gnr-main"
    service="depot-air"
  else
    slug=$(basename "$dir" | sed 's/^depot-tenant-//')
    service="depot-tenant-${slug}"
  fi

  # Port
  port="?"
  if [[ -f "${dir}/.env.local" ]]; then
    port=$(grep -E '^PORT=' "${dir}/.env.local" 2>/dev/null | cut -d= -f2 || echo "?")
    [[ -z "$port" ]] && port="?"
  elif [[ -f "${dir}/.tenant-meta.json" ]]; then
    port=$(grep -oP '"port"\s*:\s*\K[0-9]+' "${dir}/.tenant-meta.json" || echo "?")
  fi

  # Service status
  if systemctl is-active --quiet "${service}" 2>/dev/null; then
    status="${GREEN}active${NC}"
  else
    status="${RED}down${NC}"
  fi

  # Disk usage (approx)
  size=$(du -sh "$dir" 2>/dev/null | cut -f1 || echo "?")

  # Service uptime (simple format)
  uptime="?"
  if systemctl show "${service}" --property=ActiveEnterTimestamp --value 2>/dev/null | grep -qE '[0-9]'; then
    started=$(systemctl show "${service}" --property=ActiveEnterTimestamp --value 2>/dev/null)
    if [[ -n "$started" ]]; then
      started_ts=$(date -d "$started" +%s 2>/dev/null || echo "0")
      now_ts=$(date +%s)
      diff_sec=$((now_ts - started_ts))
      if [[ $diff_sec -lt 60 ]]; then
        uptime="${diff_sec}s"
      elif [[ $diff_sec -lt 3600 ]]; then
        uptime="$((diff_sec / 60))m"
      elif [[ $diff_sec -lt 86400 ]]; then
        uptime="$((diff_sec / 3600))h"
      else
        uptime="$((diff_sec / 86400))d"
      fi
    fi
  fi

  # HEAD commit
  head=$(sudo -u depot bash -lc "cd $dir && git rev-parse --short HEAD 2>/dev/null" || echo "?")

  # BUILD_COMMIT sync check
  built="?"
  if [[ -f "$dir/.next/BUILD_COMMIT" ]]; then
    built=$(cat "$dir/.next/BUILD_COMMIT" | cut -c1-7)
  fi
  head_short=$(echo "$head" | cut -c1-7)
  if [[ "$built" != "$head_short" && "$built" != "?" ]]; then
    head_display="${RED}${head_short}${NC} (build: ${built} — stale)"
  else
    head_display="${head_short}"
  fi

  printf "%-20s %-8s %-20b %-10s %-8s %b\n" \
    "$slug" "$port" "$status" "$size" "$uptime" "$head_display"
done

echo ""
echo -e "${CYAN}Legend:${NC}"
echo -e "  ${GREEN}active${NC} = service running, ${RED}down${NC} = service tidak jalan"
echo -e "  HEAD ${RED}stale${NC} = git ada di commit baru tapi build belum di-update (jalankan update-all.sh)"
echo ""
echo "Update semua: sudo bash scripts/tenant-setup/update-all.sh"
echo "Add tenant baru: sudo bash scripts/tenant-setup/setup-tenant.sh <slug> \"<Nama>\" <email>"
