# Auto-Deploy via GitHub Webhook

Setiap push ke branch `main` di GitHub akan **otomatis trigger `sudo depot-update`** di server. Zero-touch deployment.

## Alur

```
[Edit code lokal]
      ↓
[git push origin main]
      ↓
[GitHub kirim POST ke https://depot.genster.my.id/api/webhooks/github-deploy]
      ↓
[Endpoint verify signature HMAC-SHA256]
      ↓
[Cek event=push AND ref=main]
      ↓
[Spawn `sudo depot-update` async]
      ↓
[Server pull + build + restart]
      ↓
[Log ke /admin/audit-log]
```

**Waktu total dari push ke live: 30 detik – 2 menit** (tergantung build).

## Setup (Sekali Saja)

### Langkah 1 — Generate Webhook Secret

Di server:

```bash
openssl rand -hex 32
# Output contoh: a1b2c3d4e5f6789...
```

**Copy** hasil output ini — akan dipakai di 2 tempat.

### Langkah 2 — Set Env Var di Server

```bash
cd /opt/depot-air
# Tambah ke .env.local (JANGAN commit ke git)
echo 'GITHUB_WEBHOOK_SECRET="paste-secret-dari-step-1-di-sini"' >> .env.local
```

### Langkah 3 — Configure Sudoers (izinkan service run depot-update tanpa password)

```bash
# Cek user yang jalankan depot-air.service
systemctl show depot-air.service | grep User
# Output biasanya: User=root  (kalau root, skip langkah ini)
# Kalau User=depot-air atau lainnya, lanjut:

sudo visudo -f /etc/sudoers.d/depot-air
```

Isi file:
```
depot-air ALL=(ALL) NOPASSWD: /usr/local/bin/depot-update
```

Ganti `depot-air` dengan user service Anda kalau berbeda. Save & exit (Ctrl+X → Y).

**Kalau service run sebagai root** (yang tampak dari `systemctl show`), langkah ini bisa di-skip.

### Langkah 4 — Restart Service

```bash
sudo systemctl restart depot-air.service
```

### Langkah 5 — Register Webhook di GitHub

1. Buka https://github.com/jafarains-cmd/depotgnr/settings/hooks/new
2. Isi form:
   - **Payload URL**: `https://depot.genster.my.id/api/webhooks/github-deploy`
   - **Content type**: `application/json`
   - **Secret**: paste secret dari Langkah 1 (harus sama!)
   - **SSL verification**: Enable (karena Cloudflare Tunnel HTTPS)
   - **Which events?**: pilih "Just the push event"
   - **Active**: ✓ centang
3. Klik **Add webhook**

### Langkah 6 — Test

Setelah tambah webhook, GitHub otomatis kirim ping event. Cek:

1. **Di GitHub webhook settings** → scroll ke "Recent Deliveries"
   - Harusnya ada 1 delivery dengan response `200 OK`
   - Isi response: `{"status":"pong","zen":"Webhook ready"}`

2. **Test manual dari browser**:
   ```
   https://depot.genster.my.id/api/webhooks/github-deploy
   ```
   Harusnya return:
   ```json
   {
     "status": "ok",
     "endpoint": "GitHub webhook receiver",
     "configured": true,
     "hint": "Webhook ready..."
   }
   ```

3. **Test full flow** — push commit kecil ke main dari laptop:
   ```bash
   git commit --allow-empty -m "test webhook auto-deploy"
   git push origin main
   ```
   Cek di server:
   ```bash
   journalctl -u depot-air.service -f
   # Harusnya lihat: "Pull kode terbaru..." dalam ~5 detik setelah push
   ```
   Atau cek di `/admin/audit-log` — cari action `deploy.webhook-triggered`.

## Cara Kerja Detail

### Security

- **HMAC-SHA256 signature** — setiap request GitHub kirim header `X-Hub-Signature-256` = HMAC(body, secret). Server verify sebelum trust payload.
- **Timing-safe compare** — pakai `crypto.timingSafeEqual()` cegah timing attack.
- **Payload size limit** — max 1 MB, cegah abuse.
- **Only branch `main`** — push ke branch lain (feature/dev) TIDAK trigger deploy.
- **Audit log** — setiap trigger tercatat: commit hash, author, message, timestamp.

### Response Time

Endpoint return response < 500ms:
- Verify signature (~1ms)
- Parse JSON (~1ms)
- Log audit (~10ms)
- Spawn detached process (~5ms)
- **Deploy berjalan async** di background — GitHub tidak menunggu.

Kalau > 10 detik, GitHub akan retry 3x. Endpoint dirancang cepat supaya tidak double-trigger.

## Monitoring

### Cek History Deployment

- **/admin/audit-log** → filter action = `deploy.webhook-triggered`
- **/admin/security** dashboard → aktivitas kritis 7 hari

### Live Log Deployment

```bash
journalctl -u depot-air.service -f
```

Kalau ada error saat build/deploy, akan muncul di log ini.

### Cek Webhook Deliveries di GitHub

- https://github.com/jafarains-cmd/depotgnr/settings/hooks
- Klik webhook → scroll ke "Recent Deliveries"
- Klik delivery untuk lihat request/response detail
- Kalau failed, ada tombol "Redeliver"

## Troubleshooting

### Response 401 "Invalid signature"

- Secret di server ≠ secret di GitHub webhook config
- Fix: pastikan Langkah 1 & 5 pakai secret yang sama
- Test: `curl https://depot.genster.my.id/api/webhooks/github-deploy` — harusnya `configured: true`

### Response 503 "Webhook not configured"

- `GITHUB_WEBHOOK_SECRET` belum di-set di `.env.local`
- Fix: cek `cat /opt/depot-air/.env.local | grep WEBHOOK`
- Setelah tambah, restart service

### Response 200 tapi deploy tidak jalan

- Sudoers belum di-config → service tidak bisa `sudo depot-update`
- Cek: `journalctl -u depot-air.service -n 50 | grep sudo`
- Kalau ada error "sudo: no tty present", tambah sudoers rule (Langkah 3)

### Ada delay 5+ menit

- Cloudflare Tunnel mungkin cache — normalnya < 30 detik
- Cek "Recent Deliveries" di GitHub webhook settings
- Kalau webhook sudah delivered tapi deploy telat, cek `journalctl` untuk backlog

### Deploy sukses tapi UI tidak update

- Browser cache — hard refresh (Ctrl+Shift+R)
- Atau `.next/BUILD_ID` corrupt — clear dengan `rm -rf .next && sudo depot-update`

## Nonaktifkan Sementara

Kalau perlu disable webhook (mis. saat maintenance):

**Opsi 1: Non-aktifkan di GitHub**
- Buka webhook settings di GitHub → uncheck "Active"
- Bisa re-enable kapan saja

**Opsi 2: Unset env var**
```bash
# Comment atau hapus baris di .env.local:
# GITHUB_WEBHOOK_SECRET="..."
sudo systemctl restart depot-air.service
# Endpoint akan return 503 → GitHub webhook mark failed tapi tidak spam
```

## Rollback Kalau Deploy Bermasalah

Kalau auto-deploy push kode yang error, backup + rollback masih ada:

```bash
# Rollback ke commit sebelum push terakhir:
cd /opt/depot-air
git log --oneline -5   # lihat commit history
git reset --hard <commit-hash-sebelum-error>
sudo depot-update
```

Atau pakai script rollback yang sudah ada:
```bash
sudo bash /opt/depot-air/scripts/rollback-major.sh
```

## Security Checklist

- [ ] Secret di-generate random (min 32 chars hex)
- [ ] Secret tidak commit ke git (harus di `.env.local` yang di-gitignore)
- [ ] Sudoers rule specific untuk `depot-update` saja (bukan `ALL`)
- [ ] Webhook HTTPS enabled di GitHub (bukan HTTP)
- [ ] Branch protection di GitHub `main` (opsional tapi recommended):
  - Require pull request reviews
  - Require status checks pass
  - Include administrators
- [ ] Cek `/admin/audit-log` berkala untuk deploy events yang mencurigakan
