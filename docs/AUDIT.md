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

- [x] ~~**3. Hapus user yang punya transaksi**~~ _(severity: minor)_ ✅
  ~~Saat ini set null, nama "—" di history laporan. Ganti: soft-delete /
  deaktivasi user dengan nama tetap.~~
  Implementasi: deleteUser() sekarang punya parameter mode "soft"|"hard".
  Default soft = set banned=true + hapus sesi aktif. Hard = hapus permanen
  (lama). UI ada 2 tombol: "Nonaktifkan" (amber, recommended) + "Hapus×"
  (red kecil). Action reactivateUser() untuk batalkan ban.

- [x] ~~**4. Refund / void transaksi UI tidak prominent**~~ _(severity: minor)_ ✅
  ~~Logic ada di kode, tapi kasir kesulitan menemukan tombolnya.~~
  Implementasi: (1) Card "Zona Bahaya" terpisah di detail nota, prominent
  merah dengan peringatan + countdown sisa hari. (2) Tab filter Aktif/
  Dibatalkan/Semua di list /kasir/transaksi dengan count badge. (3) Badge
  "⊗ BATAL" lebih jelas di list row.

## 🟠 NOTIFIKASI & ALERT

- [ ] **5. Alert stok rendah** _(severity: major)_
  Threshold per produk + notif WA grup saat tembus. Sekarang harus manual.

- [x] ~~**6. Piutang menua tanpa pengingat**~~ _(severity: major)_ ✅
  ~~Order belum lunas 30+ hari tidak di-flag. Belum ada follow-up otomatis ke
  pelanggan.~~
  Implementasi: lib/piutang.ts dengan getPiutangThreshold (default 30 hari,
  configurable di /admin/pengaturan → tab Depot, key
  `thresholdPiutangMenuaHari`, set 0 untuk nonaktif) + countPiutangMenua.
  Banner merah di /pembayaran kalau ada piutang > threshold + badge "🕒 N
  hari · MENUA" (merah pulse) di kartu order piutang.

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

- [x] ~~**12. Audit log tidak ada**~~ _(severity: major)_ ✅
  ~~Tidak bisa telusuri "siapa edit harga produk kemarin", "siapa hapus
  pelanggan X". Backbone trust.~~
  Implementasi: schema audit_log (append-only, kolom action/entity/entityId/
  before/after/meta JSON + actorUserId + createdAt). Helper logAudit() di
  lib/audit.ts. Pasang di action critical: void transaksi, delete/merge/
  adjust loyalty/adjust galon pinjam pelanggan, delete/update/create/toggle
  produk, delete pengeluaran, soft/hard delete user + reactivate user.
  Halaman /admin/audit-log dengan filter range tanggal + search + dropdown
  entity + filter action + pagination. Detail JSON before/after/meta
  collapsible per row.

## 🟢 UX

- [x] ~~**13. Ganti `alert()` & `confirm()` native → toast / modal komponen**~~ _(severity: minor)_ ✅
  ~~Tidak konsisten, di mobile jelek. Banyak tempat.~~
  Implementasi: ToastProvider di root layout, `useToast()` hook dengan
  helper `success/error/info/warn`. Auto-dismiss 3.5s (error 5s, warn 4.5s),
  klik untuk close, stack vertical. Toast bottom-right desktop, full-width
  bottom mobile. Replace `alert()` di POS, /pembayaran, /admin/users, dan
  NotifSubscribe. `confirm()` native tetap dipakai (UX dialog browser
  sebenarnya OK + butuh Promise pattern kompleks untuk modal-confirm).

- [x] ~~**14. Loading state — tambah skeleton loader**~~ _(severity: cosmetic)_ ✅
  ~~Banyak halaman blank → muncul. Skeleton mengurangi kesan lambat.~~
  Implementasi: components/Skeleton.tsx (primitive + Card + Table). Next.js
  loading.tsx ditambahkan di 5 route paling sering: /pembayaran, /kasir,
  /admin/dashboard, /data-pelanggan, /pelanggan/beranda. Pulse animation
  Tailwind, no library tambahan.

- [x] ~~**15. Empty state dengan CTA**~~ _(severity: cosmetic)_ ✅
  ~~"Tidak ada data" terlalu polos. Tambah call-to-action: "[+ Buat order
  pertama]" dll.~~
  Implementasi: emoji besar + judul + deskripsi + tombol CTA di 4 empty state
  paling sering: /pelanggan/riwayat (💧 "Buat Pesanan Pertama"), /pelanggan/
  komplain (😊 "Lapor Komplain"), /admin/produk (📦), /admin/pengeluaran (💸).

- [x] ~~**16. Back-to-top button**~~ _(severity: cosmetic)_ ✅
  ~~Untuk list panjang di mobile.~~
  Implementasi: BackToTop component muncul saat scroll > 600px,
  fixed bottom-right circular brand button. Hanya mobile (sm:hidden) supaya
  tidak ganggu desktop yang punya nav samping. Smooth scroll to top.
  Mounted di AppShell (admin/kasir/kurir) + PelangganShell.

- [x] ~~**17. Server-side search di semua list pages**~~ _(severity: minor)_ ✅
  ~~Sudah di-fix /data-pelanggan. Cek halaman lain yang masih client-side
  filter.~~
  Audit + fix tambahan:
  * /pelanggan/riwayat: filter status (aktif/selesai/batal) di-pindah ke SQL
    WHERE — sebelumnya filter di JS setelah paginasi (bug sama dengan
    /data-pelanggan).
  * /kasir/order: tab filter status (pending/diproses/dijemput/...) pindah
    ke ?status= URL param + SQL WHERE.
  Sisanya (FollowUpClient, PemeliharaanClient, OrderClient untuk count
  summary) memang client-side untuk count badge — bukan bug karena
  beroperasi pada data lengkap atau hanya untuk summary.

## 🔵 PELANGGAN-FACING

- [x] ~~**18. ETA pengantaran**~~ _(severity: minor)_ ✅
  ~~Pelanggan order, tidak tahu jam berapa kurir tiba. Halaman tracking ada
  tapi tanpa estimasi.~~
  Implementasi: lib/eta.ts dengan jarak Haversine + asumsi kecepatan 25
  km/jam. API /api/track return etaMenit + jadwalAntar. Track page tampil
  card "ESTIMASI TIBA ± X menit" (emerald) saat kurir aktif, atau card
  "DIJADWALKAN" (blue) saat masih pending dengan jadwal. Riwayat pelanggan
  juga tampil chip jadwal antar untuk order yang belum selesai.

- [x] ~~**19. Loyalty progress visual**~~ _(severity: minor)_ ✅
  ~~Progress bar / tier system. Pelanggan tidak tahu "tinggal berapa galon lagi
  dapat hadiah".~~
  Implementasi: (1) Stamp card visual 10-dot di /pelanggan/loyalty
  (filled=💧, last=🎁, dashed=belum). (2) Mini progress bar di beranda
  pelanggan dengan badge "🔥 Hampir dapat!" kalau ≥80%.

- [x] ~~**20. Komplain — chat history**~~ _(severity: minor)_ ✅
  ~~Pelanggan submit, admin balas via WA. Riwayat tidak tersimpan di app.~~
  Implementasi: schema baru `komplain_pesan` (append-only) + route bersama
  /komplain/[id] dengan thread chat real-time (Enter=kirim, Shift+Enter=
  baris baru). Pesan baru dari staff trigger notif WA + push ke pelanggan
  (best-effort). Read-receipt: pesan lawan auto-mark dibaca saat mount.
  Akses: pelanggan hanya milik sendiri, staff (admin/kasir) semua.
  Tombol "💬 Chat" di list admin & list pelanggan.

- [x] ~~**21. Quick reorder**~~ _(severity: cosmetic)_ ✅
  ~~Fitur "order lagi seperti minggu lalu".~~
  Implementasi: tombol "Pesan ulang" di riwayat pelanggan kirim ke
  /pelanggan/order-baru?clone=ID. Server fetch item order asli, prefill
  qtyMap di OrderForm. Banner violet "🔁 Pesan ulang dari ORD-XXX".
  Aman: hanya bisa clone order milik sendiri (filter by pelangganId).

## 🟣 SECURITY & ACCESS

- [ ] **22. Role granular: admin vs owner** _(severity: major)_
  Semua "admin" punya akses penuh. Pemilik mungkin tidak mau staf admin bisa
  hapus pengeluaran atau edit harga.

- [ ] **23. 2FA / verification kedua untuk owner** _(severity: minor)_
  Akun owner cuma password.

- [x] ~~**24. Session timeout / auto-logout**~~ _(severity: minor)_ ✅
  ~~Kasir lupa logout di komputer warnet → siapa pun bisa input transaksi.~~
  Implementasi: components/IdleLogout track aktivitas (mouse/click/key/
  touch/scroll). Idle > X menit → authClient.signOut() → redirect /login.
  Warning toast amber 1 menit sebelum logout. Konfig di pengaturan
  "Auto-Logout Staff (menit)" default 30, 0 = nonaktif. Mounted di
  AppShell (admin/kasir) + KurirLayout. Pelanggan tidak diaffected.
  Login page tampilkan banner "Sesi berakhir karena tidak aktif" kalau
  ?reason=idle.

## ⚙️ INFRA & RELIABILITY

- [ ] **25. Mode offline POS (PWA + IndexedDB)** _(severity: minor)_
  Single point of failure: 1 container Proxmox + Cloudflare Tunnel. Offline
  mode bisa nyelametin saat tunnel down.

- [ ] **26. Retry queue notif WA/Telegram** _(severity: minor)_
  Kalau credit Fonnte habis / API down, notif hilang silent. Queue + alert
  admin.

- [x] ~~**27. Health check endpoint + monitoring**~~ _(severity: minor)_ ✅
  ~~Endpoint `/api/health` + Uptime Robot / cron eksternal. Owner tahu kalau
  app down.~~
  Implementasi: /api/health route. SELECT 1 ke DB → kalau respond 200 +
  JSON {status, db, uptime, responseMs, timestamp}. Kalau DB down → 503.
  Siap dipasang ke UptimeRobot / cron monitoring eksternal.

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
- Selesai: **16** (#2, #3, #4, #6, #12, #13, #14, #15, #16, #17, #18, #19, #20, #21, #24, #27)
- Sedang dikerjakan: —
- Tersisa: **11**

_Update terakhir: 2026-06-08_
