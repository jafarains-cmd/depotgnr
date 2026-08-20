# P1 Security Checklist — Manual Actions

Wajib dikerjakan admin sekali. Tidak butuh coding, cuma cek + ganti.

## 1. Cek password kekuatan semua user

**Kenapa:** Password lemah = fondasi bocor. Semua defensive lain tidak berguna kalau admin pakai password "admin123".

**Cara:**

1. Login sebagai admin → buka `/admin/users`
2. Cek daftar user, terutama role **admin** dan **kasir**
3. Untuk setiap user, tanya langsung: **"Password Anda apa?"** atau minta mereka reset
4. Kriteria password kuat:
   - **Minimal 12 karakter** (bukan 8 lagi)
   - Kombinasi huruf besar + kecil + angka + simbol
   - **Bukan** nama, tanggal lahir, kata umum, atau `username123`
   - **Bukan** password yang sama dengan akun lain (Instagram, WA, Gmail)
5. Kalau ada password lemah → klik user → tombol Reset Password → generate password kuat baru

**Contoh password kuat:**
- `Air7Gunung!Baru9` (ada frasa mudah diingat)
- `Kasir#Rifky2026$` (nama role + tahun + simbol)
- `!AirDepot99@Malam` (tema depot)

**Contoh password lemah — WAJIB GANTI:**
- `admin123`, `password`, `depot123`
- `12345678`, `qwerty123`
- Nama user + angka (misal `rifky2020`)
- Nomor HP atau tanggal lahir

## 2. Ganti `BETTER_AUTH_SECRET` (kalau perlu)

**Kenapa:** Secret ini dipakai untuk sign session cookie. Kalau ada yang tahu (misal pernah leak di git, chat, email), mereka bisa forge session.

**Cara cek:**

```bash
ssh ke server
cd /opt/depot-air
sudo -u depot cat .env.local | grep BETTER_AUTH_SECRET
```

**Kriteria secret aman:**
- Minimal 32 karakter random
- Bukan default value (`your-secret-here`, `changeme`, dll)
- Tidak pernah di-share di chat/email/git

**Kalau perlu ganti** (generate secret baru):

```bash
# Generate secret random 64 karakter
openssl rand -hex 32
# Output contoh: a1b2c3d4e5f6...

# Edit .env.local
sudo -u depot nano /opt/depot-air/.env.local
# Ganti nilai BETTER_AUTH_SECRET dengan hasil openssl di atas

# Restart service
sudo systemctl restart depot-air
```

**PERINGATAN:** Ganti secret akan **invalidate semua session existing** — semua user (termasuk Anda) harus login ulang. Lakukan saat depot tutup, atau saat traffic minimal.

## 3. Aktifkan backup otomatis harian

**Kenapa:** Kalau server Proxmox rusak / kena ransomware / SSD failure → data ilang total tanpa backup.

**Cara:**

1. Buka `/admin/backup`
2. Cek "Backup Terakhir" — kalau > 7 hari, urgent bikin backup manual dulu:
   - Klik tombol "Backup Sekarang"
   - Verify file backup ada di `/opt/depot-air/data/backups/` atau Google Drive
3. Kalau ada tombol "Aktifkan Backup Otomatis Harian" → klik
4. Kalau belum ada auto-backup:
   - Setup cron manual di server:

     ```bash
     sudo crontab -e -u depot
     # Tambah baris:
     0 2 * * * cp /opt/depot-air/data/depot.db /opt/depot-air/data/backups/backup-$(date +\%Y\%m\%d).db && find /opt/depot-air/data/backups/ -name "backup-*.db" -mtime +30 -delete
     ```

   Ini backup setiap jam 2 pagi, simpan 30 hari terakhir.

5. **Copy backup ke luar server** — WAJIB:
   - Setup rsync ke Google Drive / laptop:

     ```bash
     # Manual sekali seminggu (atau otomatiskan)
     scp -r depot@server:/opt/depot-air/data/backups/ ~/Downloads/depot-backup/
     ```

   Atau upload ke Google Drive via `/admin/backup` tombol "Backup ke Google Drive".

**Test restore:** Backup tanpa test restore = tidak ada backup. Coba restore 1 kali ke server test untuk verify file backup bisa dipakai.

## 4. Cek env file permission

**Kenapa:** `.env.local` isi secret. Kalau kebaca user lain di server, secret bocor.

**Cara:**

```bash
ssh ke server
ls -la /opt/depot-air/.env.local
```

**Yang benar:**

```
-rw------- 1 depot depot ... .env.local
```

Perhatikan `-rw-------` (mode 600). Kalau bukan itu, fix:

```bash
sudo chown depot:depot /opt/depot-air/.env.local
sudo chmod 600 /opt/depot-air/.env.local
```

## 5. Cek SSH server (kalau server publik-facing)

**Cara:**

```bash
# Cek apakah SSH root login diperbolehkan (sebaiknya TIDAK)
sudo grep "PermitRootLogin" /etc/ssh/sshd_config

# Cek password authentication (sebaiknya NO, pakai SSH key)
sudo grep "PasswordAuthentication" /etc/ssh/sshd_config
```

**Ideal config di `/etc/ssh/sshd_config`:**

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Kalau setting-nya beda, edit lalu restart:

```bash
sudo systemctl restart sshd
```

**PERINGATAN:** Sebelum ubah SSH config, **pastikan SSH key Anda sudah bekerja**. Kalau tidak, Anda bisa lock-out dari server.

## 6. Install fail2ban (bonus, kalau server exposed ke internet)

**Kenapa:** Fail2ban auto-block IP yang failed login berulang.

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Cek status
sudo fail2ban-client status sshd
```

Default sudah cukup — 5 failed SSH login dari 1 IP = block 10 menit.

## 7. Cek Cloudflare Tunnel security

**Kenapa:** Kalau pakai Cloudflare Tunnel, semua traffic lewat CF. Setting keamanan di CF panel bisa tambah lapisan.

**Cek di Cloudflare dashboard:**

1. **SSL/TLS** → mode: **Full (strict)** — bukan Flexible
2. **SSL/TLS** → **Always Use HTTPS**: ON
3. **Security** → **Bot Fight Mode**: ON
4. **Security** → **Security Level**: Medium atau High
5. **Rules** → **WAF (Web Application Firewall)**: aktifkan managed rules
6. (Opsional) **Access** → protect `/admin/*` dengan email login CF

## Ringkasan waktu

| Item | Waktu | Prioritas |
|---|---|---|
| 1. Cek password user | 15-30 menit | KRITIKAL |
| 2. Rotate secret | 5 menit (+ restart) | Tinggi kalau curiga bocor |
| 3. Backup otomatis | 15 menit setup | KRITIKAL |
| 4. Env file permission | 2 menit | Menengah |
| 5. SSH hardening | 10 menit | Tinggi kalau server public |
| 6. fail2ban | 5 menit | Bonus |
| 7. Cloudflare setting | 10 menit | Bonus |

**Total: ~1-1.5 jam** untuk cover 80% risk dasar.

## Setelah selesai

Buka `/admin/security` untuk lihat health check terbaru. Kalau ada indikator merah/kuning, kerjakan yang di-flag dulu.
