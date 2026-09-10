# Multi-Tenant Setup Scripts

Opsi 1 SaaS strategy — **instance per depot** di 1 server LXC bersama.
Setiap tenant depot dapat directory, DB, systemd service, dan APK sendiri.
Codebase 100% sama dari GitHub `main` branch — update sinkron ke semua tenant sekali jalan.

## Prerequisites

**Di server (LXC Proxmox 10.10.70.29):**
- User `depot` sudah ada
- Node.js 22+ installed
- `git`, `sqlite3`, `openssl` installed
- Cloudflare Tunnel `cloudflared` running dengan wildcard `*.genster.my.id` atau bisa add hostname per tenant di dashboard
- Existing main depot di `/opt/depot-air/` (opsional — script ini untuk tenant tambahan)

**Di local (Windows/Linux) untuk APK build:**
- `gh` CLI + `gh auth login`
- Access ke repo `jafarains-cmd/depotgnr`

## Scripts

### `setup-tenant.sh` — Provision tenant baru

```bash
sudo bash scripts/tenant-setup/setup-tenant.sh <slug> "<Nama Depot>" <admin_email>
```

**Contoh:**
```bash
sudo bash scripts/tenant-setup/setup-tenant.sh tirtaputra \
  "Depot Tirtaputra Sejahtera" owner@tirtaputra.com
```

**Yang dilakukan:**
1. Clone repo GitHub → `/opt/depot-tenant-tirtaputra/`
2. Alokasi port free (3001, 3002, ...)
3. Generate `BETTER_AUTH_SECRET` random
4. Buat `.env.local` dengan template (WA/Firebase/Drive kosong — isi manual)
5. `npm install` + `npm run build` + `npm run db:migrate`
6. Bikin systemd service `depot-tenant-tirtaputra.service`
7. Start service
8. Print instruksi step manual (Cloudflare Tunnel + admin user)

**Total waktu:** ~5-8 menit per tenant

### `list-tenants.sh` — Status semua tenant

```bash
sudo bash scripts/tenant-setup/list-tenants.sh
```

Output tabel: slug, port, status service, disk size, uptime, HEAD commit (dengan warning kalau BUILD_COMMIT stale).

### `update-all.sh` — Sync SEMUA tenant dari GitHub

```bash
sudo bash scripts/tenant-setup/update-all.sh
```

**Yang dilakukan (untuk main depot + semua tenant):**
1. `git pull --ff-only`
2. Detect apakah `package.json` berubah sejak build terakhir → `npm install`
3. Rebuild + `npm run db:migrate` + restart service
4. Skip kalau `BUILD_COMMIT` marker == HEAD (idempotent, aman dipanggil berkali-kali)

**Cocok untuk:**
- Manual: setelah push feature baru ke GitHub main → SSH → jalankan → semua tenant update
- Cron: schedule harian jam 02:00 pagi (low-traffic) untuk auto-update security patch

**Setup auto-update via cron (opsional):**
```bash
# /etc/crontab tambah baris:
0 2 * * * root /opt/depot-air/scripts/tenant-setup/update-all.sh > /var/log/depot-update-all.log 2>&1
```

### `remove-tenant.sh` — Deprovision tenant

```bash
sudo bash scripts/tenant-setup/remove-tenant.sh <slug>
```

**Aman:** Backup DB + `.env.local` ke `/var/backups/depot-tenants/<slug>-<timestamp>.*` DULU, baru destroy. Butuh konfirmasi ketik slug persis.

### `build-apk-for-tenant.sh` — Build APK khusus tenant

```bash
bash scripts/tenant-setup/build-apk-for-tenant.sh <slug> [debug|release] ["Nama Depot"]
```

**Contoh:**
```bash
# Debug APK (test internal)
bash scripts/tenant-setup/build-apk-for-tenant.sh tirtaputra debug

# Release APK signed (distribute ke owner)
bash scripts/tenant-setup/build-apk-for-tenant.sh tirtaputra release \
  "Depot Tirtaputra Sejahtera"
```

**Yang dilakukan:**
1. Trigger GH Actions workflow via `gh workflow run` dengan input:
   - `tenant_slug` = slug tenant
   - `tenant_name` = nama tampilan (untuk app name)
   - `tenant_url` = auto `https://depot-<slug>.genster.my.id`
2. Workflow patch `capacitor.config.ts` + `android/app/build.gradle`:
   - `appId` = `com.genster.depotair.<slug>` (unique, bisa co-exist di HP yang sama)
   - `appName` = nama depot
   - `server.url` = URL subdomain tenant
3. Build APK signed dengan keystore yang sama (dari GH Secrets)
4. Download artifact ke `~/Downloads/depot-apk/`

**Total waktu:** ~4-5 menit

**Kenapa appId unique per tenant?**
- User Android bisa install APK depot A, depot B, dan main GNR di HP yang sama tanpa konflik
- Kalau appId sama, install APK depot B akan overwrite APK depot A + data-nya hilang
- Cost: nama package technical (`com.genster.depotair.tirtaputra`) — tidak visible ke user

## Cloudflare Tunnel routing

Setiap tenant butuh subdomain terhubung ke port unique di localhost. **Butuh manual per tenant:**

1. Login Cloudflare dashboard → Zero Trust → Tunnels
2. Pilih tunnel yang sudah run di server (biasanya "depot" atau similar)
3. **Public Hostnames** → **Add hostname**:
   - **Subdomain**: `depot-<slug>`
   - **Domain**: `genster.my.id`
   - **Service**: HTTP → `localhost:<PORT>` (port dari `setup-tenant.sh` output)
4. Save → tunggu 30 detik - 2 menit propagation
5. Test: `curl -sI https://depot-<slug>.genster.my.id`

**Alternatif otomatis:** kalau punya Cloudflare API token, bisa scripted via `cf-api-token`. Belum diimplement — manual dulu untuk MVP.

## Workflow harian tipikal

**Update feature ke semua tenant:**
```bash
# Local (Windows)
git commit -am "feat: new feature"
git push origin main

# Server (SSH)
ssh root@10.10.70.29
sudo bash /opt/depot-air/scripts/tenant-setup/update-all.sh
```

**Add tenant baru:**
```bash
# Server
sudo bash /opt/depot-air/scripts/tenant-setup/setup-tenant.sh \
  airjaya "Depot Air Jaya" owner@airjaya.com

# → follow instruction untuk CF Tunnel + create admin user

# Local (untuk APK)
bash scripts/tenant-setup/build-apk-for-tenant.sh airjaya release "Depot Air Jaya"

# → kirim APK ke owner via WA/Drive
```

**Cek status semua tenant:**
```bash
sudo bash /opt/depot-air/scripts/tenant-setup/list-tenants.sh
```

## Constraints & Trade-offs Opsi 1 vs Opsi 2 (multi-tenant SaaS)

**Opsi 1 (yang script ini implement) — bagus untuk:**
- 1-15 depot
- Ingin data isolation absolut (setiap depot LXC/directory sendiri)
- Tidak butuh centralized dashboard cross-tenant
- Simple support (bug 1 tenant tidak affect yang lain)

**Opsi 2 (multi-tenant SaaS di 1 DB) — evaluate kalau:**
- Sudah 10+ depot dan operasional deploy N instance mulai berat
- Butuh super admin dashboard (mis. "top depot revenue nasional")
- Mau public signup + self-service (tanpa saya provision manual)

Lihat [`docs/PRD_MULTITENANT.md`](../../docs/PRD_MULTITENANT.md) untuk detail Opsi 2 (belum diimplement).

## Bottleneck alert — kapan upgrade infra

Server current: 1 CPU core, 3GB RAM.

| Jumlah tenant | Status | Action |
|---------------|--------|--------|
| 1-5 | ✅ Cukup | Zero upgrade |
| 5-15 | ✅ Baik | Monitor CPU peak, add swap kalau perlu |
| 15-30 | ⚠️ Upgrade | LXC → 2-4 core CPU, 6-8 GB RAM (via Proxmox web UI) |
| 30+ | ❌ Refactor | Migrate ke Opsi 2 + Postgres |

## Troubleshooting

**Setup gagal di `npm run build`:**
- Cek RAM: `free -h` — build peak ~1.5GB. Kalau tight, matikan service lain sementara
- Cek log build: output script sudah verbose, scroll ke atas

**Service tidak start:**
```bash
journalctl -u depot-tenant-<slug> -n 50
```

**Port konflik:**
- Script auto-alokasi 3001-3099
- Kalau semua ke-pake, edit script batas atas

**update-all.sh fail di 1 tenant tapi lanjut ke yang lain:**
- Summary di akhir tunjukkan mana fail
- Debug per-tenant: `sudo bash update-all.sh` cuma untuk tenant itu (belum ada flag, edit script sementara)

**APK build gagal:**
- Cek GH Actions log
- Common: keystore secret belum di-set (butuh 4 secret: ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD)
- Cek [`docs/ANDROID_APK_GUIDE.md`](../../docs/ANDROID_APK_GUIDE.md) untuk setup keystore
