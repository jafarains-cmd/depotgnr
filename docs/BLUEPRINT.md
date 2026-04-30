# Blueprint Aplikasi Depot Air Minum

> Status: **Living document** — dimulai 2026-04-29. Update setiap kali ada keputusan arsitektur / fitur baru.
> Live: https://depot.genster.my.id · Repo: https://github.com/jafarains-cmd/depotgnr

---

## 1. Ringkasan

Aplikasi **POS + Order Management** untuk satu depot air minum lokal (UMKM), multi-channel order (web, WhatsApp bot, Telegram bot, walk-in), dengan integrasi notifikasi & sinkronisasi Google Sheets.

**Tech stack:**
- Next.js 15 (App Router) · React 19 · Tailwind
- Better Auth (email + username + phone OTP)
- Drizzle ORM + SQLite (`better-sqlite3`)
- WhatsApp (provider), Telegram (grammy), Google Apps Script (sheets sync)
- Hosting: LXC Proxmox + Cloudflare Tunnel

**Aktor:**
- **Admin** — kelola produk, pelanggan, inventory, laporan, pengaturan
- **Kasir** — POS walk-in, kelola order antar, cetak/kirim nota
- **Kurir** _(baru, Fase 1)_ — antar order, konfirmasi diantar, upload bukti
- **Pelanggan** — order online, lihat riwayat, kelola akun

---

## 2. Modul Saat Ini

### Admin (`src/app/admin/`)
| Halaman | Fungsi |
|---|---|
| `dashboard` | KPI harian (omzet, order pending, stok, user) |
| `produk` | CRUD produk + harga (3 jenis: isi ulang, tukar galon, beli baru) |
| `pelanggan` | Daftar pelanggan + map picker + tracking galon dititip |
| `inventory` | Stok galon (kosong/terisi/rusak) + mutasi stok |
| `laporan` | Omzet harian, breakdown produk, filter date range |
| `pengaturan` | Identitas depot, template notif, telegram IDs, apps script |
| `peta` | Visualisasi lokasi pelanggan (Google Maps + OSM fallback) |
| `users` | Kelola user (role, ban, impersonate) |
| `bantuan` | Dokumentasi internal |
| `order`, `transaksi` | Redirect ke shared UI kasir |

### Kasir (`src/app/kasir/`)
| Halaman | Fungsi |
|---|---|
| `pos` | Interface transaksi kasir, cart + checkout |
| `order` | List order (filter status) + detail + actions |
| `transaksi` | List nota, detail, cetak/send WA |

### Pelanggan (`src/app/pelanggan/`)
| Halaman | Fungsi |
|---|---|
| `beranda` | Dashboard ringkas |
| `order-baru` | Form order interaktif (produk, qty, alamat, jadwal) |
| `riwayat` | List order selesai |
| `profil` | Edit data, link Telegram |

### Universal (`src/app/akun/`)
| Halaman | Fungsi |
|---|---|
| `akun` | Set username & password — semua role bisa akses |

---

## 3. Skema Database (Domain)

| Tabel | Kolom Utama |
|---|---|
| `produk` | nama, hargaIsiUlang, hargaTukar, hargaBeliBaru, aktif |
| `pelanggan` | userId, nama, telp, alamat, koordinat, tipe(umum\|langganan), catatan |
| `galonPelanggan` | galon dititip per produk |
| `orderHeader` | nomorOrder, pelangganId, sumber, alamatAntar, jadwal, status, kurirUserId, totalEstimasi, transaksiId, sheetRowId |
| `orderItem` | produkId, qty, jenis, hargaEstimasi |
| `transaksi` | nomorNota, kasirUserId, pelangganId, subtotal, diskon, total, metodeBayar, status |
| `transaksiItem` | produkId, qty, hargaSatuan, subtotal, jenis |
| `stokGalon` | produkId, status, jumlah |
| `mutasiStok` | produkId, status, perubahan, alasan, ref |
| `pengaturan` | key-value config |
| `syncQueue`, `syncConflict`, `chatSession` | Sheets sync + bot state |

---

## 4. Bisnis Flow (Saat Ini)

**Order pelanggan web:**
`browse → cart → alamat & jadwal → submit (pending) → admin proses (diproses) → assign kurir (diantar) → konfirmasi (selesai)`

**POS kasir:**
`walk-in / cari pelanggan → pilih produk + jenis + qty → diskon (manual) → bayar (cash/transfer/qris) → nota`

**Order WhatsApp bot:**
`ORDER → pilih produk (P1, P2 + qty) → alamat → auto-create order + auto-create pelanggan baru`

**Order Telegram bot:**
`/start CODE (link akun) → /order (buka web) atau /status (cek order)`

**Inventory:**
Track stok galon per status. Mutasi otomatis dari transaksi/order + manual entry oleh admin (selalu tercatat alasan).

---

## 5. Integrasi Eksternal

- **WhatsApp** (`src/lib/whatsapp.ts`, `waBot.ts`): OTP login + notifikasi order
- **Telegram** (`src/lib/telegram.ts`): grammy bot — link akun, status, order, notif grup per topic per status
- **Google Sheets** (`src/lib/sheets.ts`): Apps Script Web App — push transaksi/order/pelanggan/produk + conflict resolver via `syncQueue` & `syncConflict`
- **Google Drive** _(akan ditambah Fase 1)_: upload bukti foto kurir via Apps Script
- **Maps**: Google Maps + OpenStreetMap fallback (`MapView*.tsx`, `LocationPicker.tsx`)

---

## 6. Roadmap Fitur (April 2026 → seterusnya)

Eksekusi serial, urutan disepakati 2026-04-29.

### Fase 1 · Dashboard Kurir _(✅ done)_
**Tujuan:** kurir punya halaman sendiri untuk tracking order yang dia antar.

**Schema:**
- Role enum tambah `kurir`
- `orderHeader.buktiFotoUrl: text?`
- `orderHeader.diantarAt: timestamp?`

**Fitur:**
- Halaman `/kurir` mobile-first: list order assigned ke saya hari ini
- Detail: alamat tap-to-Maps, telp tap-to-WA
- Tombol "Sudah Diantar" → upload foto → status=selesai

**Storage foto:** Google Drive lewat Apps Script existing.

---

### Fase 2 · QRIS Statis + Multi-Channel Payment _(✅ done)_
**Tujuan:** pelanggan bisa bayar via QRIS, DANA, atau transfer bank dari halaman web — kasir konfirmasi manual.

**Schema:**
- `transaksi.metodeBayar` tambah `dana`
- `transaksi.buktiBayarUrl: text?`
- Pengaturan: gambar QRIS, nomor DANA, list rekening bank

**Fitur:**
- Halaman pembayaran pelanggan (pilih channel → tampilkan info bayar + nominal)
- Upload bukti screenshot
- Kasir/admin: badge "Menunggu Konfirmasi" → tombol "Konfirmasi Lunas"
- Notif WA otomatis saat dikonfirmasi

---

### Fase 3 · Order Berulang / Langganan
**Tujuan:** pelanggan set jadwal antar rutin (mis: Senin & Kamis), sistem auto-generate order.

**Bisnis rule:** bayar **per antar** (tidak prepaid).

**Schema:**
- Tabel `langganan`: pelangganId, hariAktif (json `["mon","thu"]`), produkId, qty, jenis, jamAntar, alamat, aktif
- `orderHeader.langgananId: text?`

**Fitur:**
- `/pelanggan/langganan` — setup, pause, resume
- `/admin/langganan` — monitor
- Cron systemd timer / node-cron jam 05.00 → generate order pending hari itu
- Notif WA H-1 sore: konfirmasi besok antar (balas BATAL kalau libur)

---

### Fase 4 · Tracking Kurir Live _(✅ done)_
**Tujuan:** pelanggan bisa lihat posisi kurir realtime saat order diantar.

**Schema:**
- Tabel `lokasiKurir`: orderId, lat, lng, timestamp, kurirUserId

**Fitur:**
- Kurir HP: tombol "Mulai Antar" → izin geolocation → push lokasi tiap 30s
- Halaman publik `/track/[orderId]?token=...` — peta marker kurir + tujuan + ETA
- Stop saat konfirmasi diantar
- Auto-kirim link tracking via WA saat status berubah ke "diantar"

---

### Fase 5 · Loyalty + Referral _(✅ done)_
**Tujuan:** retensi pelanggan via cashback per galon + program referral.

**Aturan:**
- **Earn:** Rp 250 × qty galon (order antar) atau Rp 500 × qty galon (datang ke depot) — dipicu saat transaksi `lunas`
- **Redeem:** saldo Rp dipotong langsung di checkout, max sampai habis
- **Referral:**
  - Tiap pelanggan punya kode unik 6 huruf
  - Pelanggan baru daftar pakai kode → saat order pertama lunas:
    - Referee dapat **diskon Rp 5.000** di order pertama
    - Referrer dapat **Rp 5.000 saldo loyalti**

**Schema:**
- `pelanggan.saldoLoyalti: int default 0`
- `pelanggan.kodeReferral: text unique`
- `pelanggan.referredBy: text?`
- Tabel `mutasiLoyalti`: pelangganId, jumlah, tipe(earn\|redeem\|referral), refTransaksiId, deskripsi

**Halaman baru:**
- `/pelanggan/loyalty` — saldo, history, share kode via WA
- `/admin/loyalty` — monitor & manual adjustment

---

### Fase 6 · PWA + Push Notif _(✅ done)_
**Tujuan:** app bisa di-install ke home screen + push notif ke pelanggan.

**Tasks:**
- `manifest.json` + ikon (192, 512, maskable)
- Service worker + offline shell
- Web Push API subscribe + tabel `pushSubscription`
- Trigger: order status, jadwal langganan H-1, dapat poin loyalti

---

### Fase 7 · Analitik Prediksi _(✅ done)_
**Tujuan:** bantu admin proaktif follow-up pelanggan yang biasanya order tapi belum.

**Tasks:**
- Hitung interval rata-rata + std deviasi order per pelanggan
- Halaman `/admin/analitik/follow-up` — list pelanggan due
- Tombol kirim reminder WA massal
- Widget churn risk di dashboard

---

## 7. Konvensi & Catatan Operasi

- **Login:** 1 kolom user (auto-detect email/username/nomor WA) + password. Mode WA → flow OTP otomatis.
- **Halaman `/akun`** universal untuk semua role: set username & password.
- **Deploy update:** `ssh root@<server> → su - depot → cd /opt/depot-air → git pull && npm ci && npm run build → exit → systemctl restart depot-air`
- **DB SQLite:** `/opt/depot-air/data/depot.db` (production) · `data/depot.db` (lokal)
- **Migration:** `npm run db:generate` lalu `npm run db:migrate`

---

## 8. Roles & Hak Akses

| Role | Akses |
|---|---|
| `admin` | Semua halaman /admin/* + /kasir/* + /akun |
| `kasir` | /kasir/* + /akun |
| `kurir` _(baru)_ | /kurir/* + /akun |
| `pelanggan` | /pelanggan/* + /akun (default saat daftar) |

---

## 9. Changelog Keputusan

| Tanggal | Keputusan |
|---|---|
| 2026-04-29 | Login auto-detect (email/username/WA) + halaman /akun universal |
| 2026-04-29 | Roadmap Fase 1–7 disepakati, urutan eksekusi serial |
| 2026-04-29 | Loyalty rate: Rp 250/galon (antar), Rp 500/galon (depot); Referral Rp 5.000 dua arah |
| 2026-04-29 | QRIS statis + DANA + transfer bank; bukti upload; kasir konfirmasi manual |
| 2026-04-29 | Foto bukti kurir disimpan di Google Drive via Apps Script |
| 2026-04-29 | Order langganan: bayar per antar (no prepaid) |
| 2026-04-29 | Fase 2: pembayaran online QRIS+DANA+Transfer di orderHeader (bukan transaksi); halaman /pembayaran universal admin+kasir |
| 2026-04-29 | Kasir bisa akses /kurir + Mode Kurir di nav |
| 2026-04-29 | Tipe pengantaran jemput-antar (status dijemput, diisi) + walk-in order kasir + notif WA per status |
| 2026-04-29 | Fase 5: Loyalty earn (Rp 250 antar / Rp 500 depot) + referral Rp 5.000 dua arah + redeem di checkout |
| 2026-04-29 | Stamp galon gratis (10 galon = Rp 5.000 saldo, configurable) + UI upload QRIS |
| 2026-04-29 | Fase 6: PWA (manifest + SW) + push notif untuk status order, pembayaran lunas, stamp reward |
| 2026-04-29 | Fase 4: tracking kurir live (geolocation 30s push) + halaman /track/[id]?token publik dengan peta + link auto-WA saat status=diantar |
| 2026-04-29 | Fase 7: analitik prediksi (interval avg + std dev) + halaman follow-up + reminder WA massal + widget churn risk di dashboard |
