# Panduan Major Update Dependencies

Prosedur update paket dengan breaking changes untuk Depot Air. Dijalankan
di window maintenance (malam / depot tutup). Include rollback plan kalau
error.

## Kapan pakai panduan ini

- Ada notifikasi vulnerability di `/admin/security` yang butuh major update
- npm audit report bilang "fix available via `npm audit fix --force`"
- Waktu jadwal maintenance sudah tiba (jangan spontan)

**JANGAN** pakai `npm audit fix --force` langsung — resiko break build.
Pakai script terstruktur ini yang punya checkpoint per stage.

## Persiapan (30 menit sebelum eksekusi)

- [ ] Konfirmasi depot benar-benar tutup (tidak ada order aktif)
- [ ] Semua kasir sudah tutup shift
- [ ] Ada koneksi internet stabil ke server
- [ ] Backup DB sudah sukses hari ini (cek `/admin/backup`)
- [ ] Punya akses SSH ke container Proxmox
- [ ] Screenshot dashboard sekarang untuk perbandingan

## Eksekusi

### Step 1 — SSH ke server

```bash
ssh root@<server>
pct enter <container-id>       # kalau via Proxmox
cd /opt/depot-air
```

### Step 2 — Jalankan script major-update

```bash
sudo bash /opt/depot-air/scripts/major-update.sh
```

Script akan:
1. Buat **backup tag Git** `pre-major-update-YYYY-MM-DD-HHMM`
2. Backup DB ke lokasi lokal `/root/depot-backup-YYYY-MM-DD-HHMM.db`
3. Backup `.env.local` ke `/root/depot-env-YYYY-MM-DD-HHMM.backup`
4. Update paket **stage per stage** dengan konfirmasi
5. Test build setelah setiap stage
6. Kalau ada error, tampilkan command rollback

Setiap stage prompt konfirmasi:
- **[y]** lanjut ke stage berikut
- **[n]** stop di sini (rollback stage terakhir manual)
- **[q]** quit + rollback semua

### Stage yang dijalankan

| Stage | Paket | Risk | Waktu |
|---|---|---|---|
| 1 | Auto-fix aman (better-auth patch) | LOW | 2 menit |
| 2 | `drizzle-kit` + chain esbuild-kit | MEDIUM | 5 menit |
| 3 | `next` major update | HIGH | 10 menit |

**Total estimasi: 20-30 menit** kalau semua stage lancar. Kalau ada
masalah di stage tertentu, bisa stop dan rollback stage tsb saja.

## Verifikasi Setelah Update

Setelah script selesai:

```bash
# 1. Cek service running
systemctl status depot-air.service

# 2. Cek endpoint
curl -I https://depot.genster.my.id
# Harusnya HTTP/2 200
```

Kemudian di browser:

- [ ] Buka https://depot.genster.my.id — landing page loading
- [ ] Login sebagai admin
- [ ] Test buka `/admin/security` — scan dependencies, harusnya vuln count turun
- [ ] Test buka `/admin/laporan` — chart & tabel loading
- [ ] Test order dummy: buat order → kirim ke kurir → antar → lunas
- [ ] Test buka detail transaksi — modal muncul normal
- [ ] Cek console browser (F12) — tidak ada error merah

## Kalau Error di Tengah Jalan

### Skenario A: Build gagal di stage tertentu

Script otomatis pause. Ikuti instruksi di layar:

```bash
sudo bash /opt/depot-air/scripts/rollback-major.sh
```

Script rollback akan:
1. `git reset --hard <backup-tag>` — balik ke commit sebelum update
2. `rm -rf node_modules` + `npm ci` — install ulang paket versi lama
3. `npm run build`
4. Restart service

### Skenario B: Service tidak mau start

```bash
# Cek log
journalctl -u depot-air.service -n 50

# Kalau schema DB error, restore DB backup
systemctl stop depot-air.service
cp /root/depot-backup-YYYY-MM-DD-HHMM.db /opt/depot-air/data/depot.db
systemctl start depot-air.service
```

### Skenario C: Data hilang atau corrupt

Restore dari Google Drive backup terakhir:

```bash
# List backup file di Drive (via aplikasi Anda /admin/backup)
# Download file .db terakhir
# Kemudian:
systemctl stop depot-air.service
cp /path/to/downloaded-backup.db /opt/depot-air/data/depot.db
systemctl start depot-air.service
```

## Post-Update

Setelah verifikasi semua OK:

- [ ] Update `docs/AUDIT.md` — mark checklist yang sudah selesai
- [ ] Buka `/admin/security` → **Scan Dependencies** — screenshot hasil
  baru untuk arsip
- [ ] Kalau tag Git backup tidak lagi diperlukan (1-2 minggu stabil):
  ```bash
  cd /opt/depot-air
  git tag -d pre-major-update-YYYY-MM-DD-HHMM
  ```
- [ ] Hapus backup file lokal setelah yakin stabil:
  ```bash
  rm /root/depot-backup-YYYY-MM-DD-HHMM.db
  rm /root/depot-env-YYYY-MM-DD-HHMM.backup
  ```

## FAQ

**Q: Bisa update satu paket saja tanpa script?**

Bisa. Contoh:
```bash
cd /opt/depot-air
git tag pre-drizzle-update
npm install drizzle-kit@latest
npm run build && sudo depot-update
```

Kalau error: `git reset --hard pre-drizzle-update && rm -rf node_modules && npm ci`

**Q: Perlu update Node.js juga?**

Cek versi sekarang: `node -v`. Kalau di bawah LTS terbaru:
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```
Update Node sebaiknya dilakukan **sebelum** major update npm packages,
karena beberapa paket butuh Node version minimum.

**Q: Berapa lama window maintenance yang ideal?**

- **Minimum:** 30 menit (kalau semua lancar)
- **Aman:** 1 jam (kalau ada masalah kecil)
- **Buffer:** 2 jam (kalau perlu rollback dan investigasi)

Jangan mulai update kalau sisa waktu < 30 menit sebelum depot buka lagi.

**Q: Bisa dilakukan remote / dari HP?**

Bisa via SSH mobile app (Termius, JuiceSSH). Tapi:
- Layar HP kecil, sulit baca log error
- Kalau harus rollback + investigasi, laptop jauh lebih nyaman
- Rekomendasi: dari laptop dengan koneksi stabil

## Kontak Darurat

Kalau semua rollback gagal dan aplikasi tidak mau nyala:
1. Screenshot semua error
2. Backup DB terakhir dari Google Drive
3. Reinstall from scratch via `scripts/install.sh` di container baru,
   restore DB
