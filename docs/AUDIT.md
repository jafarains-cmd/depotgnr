# Audit & Perbaikan DEPOT GNR

> Daftar perbaikan prioritas berdasarkan audit dari sudut pandang admin, kasir,
> kurir, dan pelanggan. Diurut dari paling sering bikin frustrasi → nice-to-have.
>
> **Cara baca**: `- [ ]` belum dikerjakan, `- [x] ~~teks~~` sudah dikerjakan
> (akan ditandai oleh AI saat selesai). Tiap item punya severity.

---

## 🔴 OPERASIONAL HARIAN

- [ ] **1. Tutup kas / setoran akhir shift** _(severity: major)_
  Kasir tidak tahu omzet cash harian & jumlah di tangan. Akhir hari rawan
  selisih, tidak ada audit shift handoff.

- [x] ~~**2. Dashboard kasir kosong**~~ _(severity: major)_ ✅
  ~~Kasir login langsung ke POS. Tidak ada ringkasan "transaksi saya hari ini",
  "omzet shift saya", "piutang yang saya tangani".~~
  Implementasi: stat cards (transaksi/omzet/galon/piutang hari ini), quick
  actions, list piutang ditangani, transaksi terbaru. Nav "Dashboard" baru di
  /kasir layout.

- [ ] **3. Hapus user yang punya transaksi** _(severity: minor)_
  Saat ini set null, nama "—" di history laporan. Ganti: soft-delete /
  deaktivasi user dengan nama tetap.

- [x] ~~**4. Refund / void transaksi UI tidak prominent**~~ _(severity: minor)_ ✅
  ~~Logic ada di kode, tapi kasir kesulitan menemukan tombolnya.~~
  Implementasi: (1) Card "Zona Bahaya" terpisah di detail nota, prominent
  merah dengan peringatan + countdown sisa hari. (2) Tab filter Aktif/
  Dibatalkan/Semua di list /kasir/transaksi dengan count badge. (3) Badge
  "⊗ BATAL" lebih jelas di list row.

## 🟠 NOTIFIKASI & ALERT

- [ ] **5. Alert stok rendah** _(severity: major)_
  Threshold per produk + notif WA grup saat tembus. Sekarang harus manual.

- [ ] **6. Piutang menua tanpa pengingat** _(severity: major)_
  Order belum lunas 30+ hari tidak di-flag. Belum ada follow-up otomatis ke
  pelanggan.

- [ ] **7. Reminder bonus kurir bulanan** _(severity: minor)_
  Auto-email/WA ke owner tiap awal bulan: "harus bayar bonus kurir Rp X".

- [ ] **8. Backup gagal — silent fail** _(severity: major)_
  Kalau backup harian gagal beberapa hari berturut-turut, tidak ada peringatan
  ke admin. Perlu monitor + alert.

## 🟡 DATA INTEGRITY

- [ ] **9. Edit data yang sudah ter-sync transaksi** _(severity: major)_
  Admin edit total order yang sudah jadi transaksi → mismatch silent. Perlu
  lock + jejak "edited by X at Y".

- [ ] **10. Cancel order setelah loyalty earn** _(severity: minor)_
  Bonus kurir sudah di-reverse, tapi loyalty point dari order tersebut perlu
  juga di-verify ikut reverse.

- [ ] **11. Idempotency key untuk transaksi POS** _(severity: minor)_
  Double-click "Simpan & Bayar" saat network lambat masih bisa lolos. Pakai
  idempotency key di server.

- [ ] **12. Audit log tidak ada** _(severity: major)_
  Tidak bisa telusuri "siapa edit harga produk kemarin", "siapa hapus
  pelanggan X". Backbone trust.

## 🟢 UX

- [ ] **13. Ganti `alert()` & `confirm()` native → toast / modal komponen** _(severity: minor)_
  Tidak konsisten, di mobile jelek. Banyak tempat.

- [ ] **14. Loading state — tambah skeleton loader** _(severity: cosmetic)_
  Banyak halaman blank → muncul. Skeleton mengurangi kesan lambat.

- [ ] **15. Empty state dengan CTA** _(severity: cosmetic)_
  "Tidak ada data" terlalu polos. Tambah call-to-action: "[+ Buat order
  pertama]" dll.

- [ ] **16. Back-to-top button** _(severity: cosmetic)_
  Untuk list panjang di mobile.

- [ ] **17. Server-side search di semua list pages** _(severity: minor)_
  Sudah di-fix /data-pelanggan. Cek halaman lain yang masih client-side
  filter.

## 🔵 PELANGGAN-FACING

- [ ] **18. ETA pengantaran** _(severity: minor)_
  Pelanggan order, tidak tahu jam berapa kurir tiba. Halaman tracking ada
  tapi tanpa estimasi.

- [x] ~~**19. Loyalty progress visual**~~ _(severity: minor)_ ✅
  ~~Progress bar / tier system. Pelanggan tidak tahu "tinggal berapa galon lagi
  dapat hadiah".~~
  Implementasi: (1) Stamp card visual 10-dot di /pelanggan/loyalty
  (filled=💧, last=🎁, dashed=belum). (2) Mini progress bar di beranda
  pelanggan dengan badge "🔥 Hampir dapat!" kalau ≥80%.

- [ ] **20. Komplain — chat history** _(severity: minor)_
  Pelanggan submit, admin balas via WA. Riwayat tidak tersimpan di app.

- [ ] **21. Quick reorder** _(severity: cosmetic)_
  Fitur "order lagi seperti minggu lalu".

## 🟣 SECURITY & ACCESS

- [ ] **22. Role granular: admin vs owner** _(severity: major)_
  Semua "admin" punya akses penuh. Pemilik mungkin tidak mau staf admin bisa
  hapus pengeluaran atau edit harga.

- [ ] **23. 2FA / verification kedua untuk owner** _(severity: minor)_
  Akun owner cuma password.

- [ ] **24. Session timeout / auto-logout** _(severity: minor)_
  Kasir lupa logout di komputer warnet → siapa pun bisa input transaksi.

## ⚙️ INFRA & RELIABILITY

- [ ] **25. Mode offline POS (PWA + IndexedDB)** _(severity: minor)_
  Single point of failure: 1 container Proxmox + Cloudflare Tunnel. Offline
  mode bisa nyelametin saat tunnel down.

- [ ] **26. Retry queue notif WA/Telegram** _(severity: minor)_
  Kalau credit Fonnte habis / API down, notif hilang silent. Queue + alert
  admin.

- [ ] **27. Health check endpoint + monitoring** _(severity: minor)_
  Endpoint `/api/health` + Uptime Robot / cron eksternal. Owner tahu kalau
  app down.

---

## 📋 Top 5 prioritas (kalau bingung mulai dari mana)

1. ~~Tutup kas akhir shift~~ → **#1**
2. ~~Audit log transaksi~~ → **#12**
3. ~~Alert stok rendah + piutang menua~~ → **#5, #6**
4. ~~Ganti `alert()` → toast notif~~ → **#13**
5. ~~Role granular admin vs owner~~ → **#22**

---

## Progress

- Total: **27 item**
- Selesai: **2** (#2 Dashboard kasir, #4 Refund/void UI prominent)
- Sedang dikerjakan: —
- Tersisa: **25**

_Update terakhir: 2026-05-23_
