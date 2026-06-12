# Panduan Instalasi DEPOT GNR

Panduan fresh install di server baru (mis. container Proxmox baru atau VM Ubuntu).

**Setup waktu estimasi: 30-45 menit** (mayoritas tunggu install dependencies).

---

## Daftar Isi
1. [Persyaratan Server](#1-persyaratan-server)
2. [Install Dependencies](#2-install-dependencies)
3. [Clone & Build App](#3-clone--build-app)
4. [Setup Environment](#4-setup-environment)
5. [Setup Database](#5-setup-database)
6. [Buat Admin Pertama](#6-buat-admin-pertama)
7. [Setup systemd Service](#7-setup-systemd-service)
8. [Setup Cloudflare Tunnel](#8-setup-cloudflare-tunnel-opsional-tapi-rekomendasi)
9. [Setup Apps Script (Upload + Backup)](#9-setup-apps-script-upload--backup)
10. [Setup Pengaturan Aplikasi](#10-setup-pengaturan-aplikasi)
11. [Setup Backup Otomatis (Cron)](#11-setup-backup-otomatis-cron)
12. [Setup Auto-Update Command](#12-setup-auto-update-command)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Persyaratan Server

**Minimum:**
- Ubuntu 22.04 LTS (container Proxmox, VM, VPS)
- 2 vCPU
- 2 GB RAM (4 GB recommended)
- 20 GB disk
- Internet (port 443 outbound — untuk Cloudflare tunnel + Google Apps Script)
- Akses root atau sudo

**Tidak butuh:** public IP, port forwarding, domain langsung ke server (pakai Cloudflare Tunnel).

---

## 2. Install Dependencies

Login sebagai root, lalu:

```bash
# Update package
apt update && apt upgrade -y

# Install Node.js 20 (via Nodesource)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verifikasi
node --version  # harus v20.x
npm --version   # harus 10.x

# Install build tools (untuk better-sqlite3 native compile)
apt install -y build-essential python3 git

# Install ringan tambahan
apt install -y curl ca-certificates gnupg
```

---

## 3. Clone & Build App

Buat user dedicated `depot` (best practice — service jalan tanpa root):

```bash
# Bikin user
adduser --system --group --shell /bin/bash --home /opt/depot-air depot

# Clone repo ke /opt/depot-air
cd /opt
git clone https://github.com/jafarains-cmd/depotgnr.git depot-air
chown -R depot:depot /opt/depot-air

# Install npm dependencies + build sebagai user depot
sudo -u depot bash -lc "cd /opt/depot-air && npm ci && npm run build"
```

Build pertama makan 1-2 menit. Sukses kalau tampil:
```
✓ Compiled successfully
✓ Generating static pages (XX/XX)
```

---

## 4. Setup Environment

Buat file `.env.local` di `/opt/depot-air`:

```bash
sudo -u depot bash -c "cat > /opt/depot-air/.env.local <<'EOF'
# Database (default: ./data/depot.db relative ke working dir)
DATABASE_URL=/opt/depot-air/data/depot.db

# Better Auth — wajib di-set
BETTER_AUTH_URL=https://depot-anda.example.com
BETTER_AUTH_SECRET=$(openssl rand -hex 32)

# Telegram bot (opsional, untuk notif & login)
TELEGRAM_BOT_TOKEN=
ADMIN_TELEGRAM_CHAT_ID=

# WhatsApp via Fonnte (opsional, untuk notif & OTP)
WHATSAPP_PROVIDER=fonnte
WHATSAPP_API_URL=https://api.fonnte.com/send
WHATSAPP_API_KEY=

# Sheet sync secret (opsional, untuk spreadsheet cadangan)
SHEET_SYNC_SECRET=$(openssl rand -hex 16)

# Node env
NODE_ENV=production
PORT=3000
EOF"

# Pastikan tidak world-readable (ada secret)
chmod 600 /opt/depot-air/.env.local
chown depot:depot /opt/depot-air/.env.local
```

**Ganti `BETTER_AUTH_URL` dengan domain akhir nanti** (mis. `https://depot.contoh.my.id`). Bisa diubah belakangan + restart service.

**Optional service:**
- Telegram bot → bikin via `@BotFather` di Telegram, copy token. Untuk `ADMIN_TELEGRAM_CHAT_ID`, kirim pesan ke bot lalu cek `https://api.telegram.org/bot<TOKEN>/getUpdates` untuk lihat chat_id.
- Fonnte WhatsApp → daftar di [fonnte.com](https://fonnte.com), beli device, scan QR, copy API key.

---

## 5. Setup Database

Bikin folder data + jalankan migration:

```bash
# Bikin folder data
sudo -u depot mkdir -p /opt/depot-air/data

# Jalankan migrate (bikin semua tabel)
sudo -u depot bash -lc "cd /opt/depot-air && npm run db:migrate"
```

Sukses kalau tampil "migrations applied successfully".

Verifikasi tabel sudah ada:
```bash
sudo -u depot bash -lc "sqlite3 /opt/depot-air/data/depot.db '.tables'"
```
Harus tampil: `user pelanggan transaksi order produk shift_kasir audit_log ...` dll.

---

## 6. Buat Admin Pertama

```bash
sudo -u depot bash -lc "cd /opt/depot-air && npm run db:create-admin"
```

Script akan:
- Bikin akun admin default: `admin@depot.local` / `admin123`
- (Kalau sudah ada admin, di-skip)

**Ganti password setelah login pertama** via `/akun`.

---

## 7. Setup systemd Service

Buat file service:

```bash
cat > /etc/systemd/system/depot-air.service <<'EOF'
[Unit]
Description=Depot Air Minum App
After=network.target

[Service]
Type=simple
User=depot
Group=depot
WorkingDirectory=/opt/depot-air
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

# Resource limits (opsional)
LimitNOFILE=4096
MemoryMax=1500M

[Install]
WantedBy=multi-user.target
EOF

# Reload + enable + start
systemctl daemon-reload
systemctl enable depot-air
systemctl start depot-air

# Cek status
sleep 3
systemctl status depot-air --no-pager
```

Status harus `Active: active (running)`. Verifikasi service jalan:

```bash
curl -s http://localhost:3000/api/health
```

Harus return JSON `{"status":"ok","db":"ok",...}`.

---

## 8. Setup Cloudflare Tunnel (Opsional Tapi Rekomendasi)

**Cara akses depot dari internet tanpa public IP / port forward.**

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
dpkg -i /tmp/cloudflared.deb

# Login Cloudflare (akan kasih URL untuk auth browser)
cloudflared tunnel login

# Bikin tunnel baru
cloudflared tunnel create depot-gnr
# Catat UUID yang muncul, simpan

# Setup config
mkdir -p /etc/cloudflared
cat > /etc/cloudflared/config.yml <<EOF
tunnel: <UUID-DARI-CREATE>
credentials-file: /root/.cloudflared/<UUID-DARI-CREATE>.json
ingress:
  - hostname: depot.contoh.my.id
    service: http://localhost:3000
  - service: http_status:404
EOF

# Route DNS — kalau pakai domain di Cloudflare:
cloudflared tunnel route dns depot-gnr depot.contoh.my.id

# Install sebagai service
cloudflared --config /etc/cloudflared/config.yml service install

# Start + enable
systemctl start cloudflared
systemctl enable cloudflared
```

Cek `https://depot.contoh.my.id` di browser — harus tampil halaman login.

**Update `.env.local`** ganti `BETTER_AUTH_URL` ke domain ini, restart service:
```bash
sed -i 's|BETTER_AUTH_URL=.*|BETTER_AUTH_URL=https://depot.contoh.my.id|' /opt/depot-air/.env.local
systemctl restart depot-air
```

---

## 9. Setup Apps Script (Upload + Backup)

Aplikasi pakai Apps Script sebagai proxy ke Google Drive untuk simpan foto dan backup.

**Langkah-langkah:**

1. Login dengan **akun Google owner depot** di [sheets.google.com](https://sheets.google.com)

2. Buat spreadsheet baru, namai "DEPOT GNR — Sync"

3. Extensions → Apps Script. Hapus code default.

4. Copy isi [docs/apps-script.gs](apps-script.gs) → paste ke editor

5. Copy isi [docs/apps-script-upload.gs](apps-script-upload.gs) → paste ke file baru (`+` icon → Script → namai `Upload`)

6. Di file `Code.gs` (utama), tambahkan baris `case "uploadFile": resp = handleUploadFile_(req); break;` ke fungsi `doPost` switch (lihat instruksi di apps-script-upload.gs)

7. **Set Script Properties** (Settings → Script properties):
   - Key: `TOKEN`, Value: random string panjang (mis. UUID) — **catat untuk env**

8. Deploy → New deployment:
   - Type: **Web app**
   - Execute as: **Me** (akun owner depot)
   - Who has access: **Anyone**
   - Klik Deploy → minta izin (klik Advanced → Go to ... unsafe → Allow)
   - **Catat URL Web app** (format: `https://script.google.com/macros/s/AKfyc.../exec`)

9. Bikin folder di Drive owner:
   - `Depot Air/Bukti Antar` → catat folder ID (dari URL: `folders/<ID>`)
   - `Depot Air/Bukti Bayar`
   - `Depot Air/Backup DB`

10. Set di [/admin/pengaturan](https://depot.contoh.my.id/admin/pengaturan) → tab **Integrasi**:
    - `appsScriptUrl` = URL Web app dari langkah 8
    - `appsScriptToken` = TOKEN dari langkah 7
    - `driveFolderBuktiKurir` = folder ID Bukti Antar
    - `driveFolderBuktiBayar` = folder ID Bukti Bayar
    - `driveFolderBackup` = folder ID Backup DB

11. Test: buka `/admin/backup` → klik **Backup Sekarang** → harus muncul file di Drive folder.

---

## 10. Setup Pengaturan Aplikasi

Login di `https://depot.contoh.my.id` sebagai admin → `/admin/pengaturan`. Set minimal:

**Tab Depot:**
- Nama Depot, Alamat, Telp
- Kontak WA & Telegram (untuk fitur "Hubungi Admin")
- Koordinat Lat & Lng (pakai Google Maps right-click → "What's here?")
- Max Jarak Antar (km) — default 10
- Zona Waktu (mis. Asia/Makassar untuk WIB)

**Tab Loyalty & Bonus:**
- Welcome Bonus (Rp) — default 5.000
- Bonus Referral Pelanggan (Rp)
- Bonus Referral Staff (Rp)
- Rate loyalty per galon (depot vs antar)

**Tab Notifikasi:**
- Template notif WA/Telegram (kalau pakai)
- Group ID untuk grup notif (kalau pakai)

**Tab Integrasi:**
- Apps Script (sudah di langkah 9)

**Buat produk pertama** di [/admin/produk](https://depot.contoh.my.id/admin/produk) — mis. Galon 19L isi ulang 5rb, tukar 6rb, beli baru 50rb.

**Buat user kasir/kurir** di [/admin/users](https://depot.contoh.my.id/admin/users).

---

## 11. Setup Backup Otomatis (Cron)

Bikin cron harian backup jam 2 pagi:

```bash
crontab -u depot -e
```

Tambah baris:
```
0 2 * * * cd /opt/depot-air && /usr/bin/npm run db:backup >> /var/log/depot-backup.log 2>&1
```

Buat log file:
```bash
touch /var/log/depot-backup.log
chown depot:depot /var/log/depot-backup.log
```

Verifikasi cron tersimpan:
```bash
crontab -u depot -l
```

---

## 12. Setup Auto-Update Command

Bikin command `depot-update` untuk pull + build + migrate + restart:

```bash
# Symlink script ke /usr/local/bin
ln -sf /opt/depot-air/scripts/update.sh /usr/local/bin/depot-update
chmod +x /opt/depot-air/scripts/update.sh

# Test
sudo depot-update
```

Sekarang setiap update tinggal `sudo depot-update`.

---

## 13. Troubleshooting

**Service tidak start:**
```bash
journalctl -u depot-air -n 50 --no-pager
```

**Build artifact rusak (502 di Cloudflare):**
```bash
sudo -u depot bash -lc "cd /opt/depot-air && rm -rf .next && npm run build"
systemctl restart depot-air
```

**DB locked:**
- Pastikan tidak ada backup yang ngotot jalan
- `systemctl restart depot-air`

**Cloudflare tunnel down:**
```bash
systemctl status cloudflared
journalctl -u cloudflared -n 30
```

**Apps Script upload error:**
- Cek `appsScriptUrl` masih aktif (kalau owner deploy versi baru, URL berubah)
- Cek `appsScriptToken` match dengan TOKEN di Script Properties
- Cek folder Drive masih ada + permission masih milik akun yang sama dengan Apps Script

**Login error "Invalid credentials":**
- Reset admin password: `sudo -u depot bash -lc "cd /opt/depot-air && npm run db:create-admin"` (akan re-create dengan default kalau admin existing rusak)

---

## Backup → Restore (Disaster Recovery)

Kalau server hancur, restore dari backup Drive:

1. Setup server baru (langkah 1-7 di atas — sampai service jalan)
2. Stop service: `systemctl stop depot-air`
3. Download backup terbaru dari Drive folder `Backup DB`
4. Decompress: `gunzip depot-2026-MM-DD.db.gz`
5. Replace DB: `mv depot-2026-MM-DD.db /opt/depot-air/data/depot.db`
6. Fix permission: `chown depot:depot /opt/depot-air/data/depot.db`
7. Start service: `systemctl start depot-air`

Semua data + history kembali.

---

## Multi-Tenant (Beberapa Depot di 1 Server)

Untuk install **depot kedua** di server yang sama:

1. Clone ke folder lain: `/opt/depot-air-2`
2. Pakai port lain: `PORT=3001` di `.env.local`
3. DB terpisah: `DATABASE_URL=/opt/depot-air-2/data/depot.db`
4. systemd service baru: `depot-air-2.service` (ganti WorkingDirectory + ExecStart pakai port baru)
5. Cloudflare tunnel: tambah ingress rule baru di `config.yml` untuk domain depot kedua

---

## Update / Maintenance

| Task | Command |
|---|---|
| Update aplikasi | `sudo depot-update` |
| Backup manual | `sudo -u depot bash -lc "cd /opt/depot-air && npm run db:backup"` |
| Lihat log service | `journalctl -u depot-air -f` |
| Restart service | `systemctl restart depot-air` |
| Lihat log Cloudflare | `journalctl -u cloudflared -f` |
| Reset admin password | `sudo -u depot bash -lc "cd /opt/depot-air && npm run db:create-admin"` |

---

## Estimasi Waktu Per Langkah

| Step | Waktu |
|---|---|
| 1-2. Install dependencies | 5-10 menit |
| 3. Clone + build | 5-10 menit |
| 4. Env setup | 2 menit |
| 5. Migration | 1 menit |
| 6. Admin | 30 detik |
| 7. systemd | 2 menit |
| 8. Cloudflare Tunnel | 10 menit |
| 9. Apps Script | 10-15 menit |
| 10. Pengaturan | 10 menit |
| 11-12. Cron + symlink | 2 menit |

**Total: ~45-60 menit** untuk depot baru dari scratch.

---

## Stack Reference

| Komponen | Teknologi |
|---|---|
| Framework | Next.js 15 (App Router) |
| Runtime | Node.js 20 |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| Auth | Better Auth |
| UI | Tailwind CSS 4 |
| Reverse proxy | Cloudflare Tunnel (gratis) |
| File storage | Google Drive (via Apps Script proxy) |
| Notif | WhatsApp (Fonnte) + Telegram |
| Service | systemd (Ubuntu) |

Mau install di environment lain (Docker, K8s, dll)? Baca [BLUEPRINT.md](BLUEPRINT.md) untuk arsitektur lengkap.
