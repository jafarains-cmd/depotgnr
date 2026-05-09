#!/usr/bin/env bash
# Setup systemd timer untuk backup database harian.
# Run sebagai root: sudo bash /opt/depot-air/scripts/setup-backup-timer.sh
#
# Yang dilakukan:
#   1. Buat service unit /etc/systemd/system/depot-backup.service
#   2. Buat timer unit /etc/systemd/system/depot-backup.timer
#   3. Enable + start timer (auto-run tiap hari jam 02:00)
#
# Untuk uninstall:
#   sudo systemctl disable --now depot-backup.timer
#   sudo rm /etc/systemd/system/depot-backup.{service,timer}
#   sudo systemctl daemon-reload

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Script harus dijalankan sebagai root (sudo)."
  exit 1
fi

APP_DIR="/opt/depot-air"
APP_USER="depot"
SCHEDULE="${BACKUP_SCHEDULE:-*-*-* 02:00:00}"

GREEN='\033[0;32m'
NC='\033[0m'
log() { echo -e "${GREEN}▸${NC} $*"; }

if [[ ! -d "$APP_DIR" ]]; then
  echo "Folder $APP_DIR tidak ditemukan."
  exit 1
fi

log "Membuat service unit..."
cat > /etc/systemd/system/depot-backup.service <<EOF
[Unit]
Description=Depot Air — daily database backup
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm run db:backup
StandardOutput=journal
StandardError=journal
EOF

log "Membuat timer unit (schedule: $SCHEDULE)..."
cat > /etc/systemd/system/depot-backup.timer <<EOF
[Unit]
Description=Depot Air — trigger daily backup

[Timer]
OnCalendar=$SCHEDULE
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
EOF

log "Reload systemd + enable timer..."
systemctl daemon-reload
systemctl enable --now depot-backup.timer

log "Status timer:"
systemctl status depot-backup.timer --no-pager -l | head -15
echo
log "Next run:"
systemctl list-timers depot-backup.timer --no-pager

cat <<EOF

✓ Setup selesai.

Test manual:
  sudo systemctl start depot-backup.service
  sudo journalctl -u depot-backup.service -f

Lihat log di app:
  https://depot.genster.my.id/admin/backup
EOF
