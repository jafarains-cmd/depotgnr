# Cara Pakai Spreadsheet Cadangan (Mode Darurat)

Panduan harian untuk admin saat aplikasi `depot.genster.my.id` mati / down.
Setup awal sudah ada di [PANDUAN-SPREADSHEET-CADANGAN.md](PANDUAN-SPREADSHEET-CADANGAN.md) — file ini fokus ke **alur pemakaian sehari-hari**.

---

## Aturan Singkat (WAJIB BACA)

1. **Hanya admin** yang boleh buka & input ke Spreadsheet ini. Kasir/kurir **lapor lewat WA** ke admin.
2. **Selama spreadsheet jalan, jangan input transaksi yang sama di aplikasi** kalau aplikasi sudah pulih sebagian — pilih salah satu, jangan dua-duanya.
3. **Push pending** wajib dilakukan **segera setelah server pulih**, jangan ditunda berhari-hari (master data bisa basi).
4. **Jangan hapus baris yang sudah `synced`** — itu jejak audit. Boleh hapus yang masih `pending` kalau salah input.

---

## Pagi Hari — Cek Status Server (rutin)

Setiap pagi sebelum mulai operasional:

1. Buka Spreadsheet **"DEPOT GNR — Cadangan"**
2. Klik menu **🪣 DEPOT GNR → 📊 Cek Status Server**
3. Lihat hasil:
   - 🟢 **Server ONLINE** → aplikasi normal, **tidak perlu input di sheet**. Tutup spreadsheet.
   - 🔴 **Server OFFLINE / BERMASALAH** → masuk mode darurat (lanjut ke bawah).

> Tip: kalau kasir/kurir di lapangan tiba-tiba lapor app error, langsung cek status server. Kalau memang down, kabari mereka **"sementara semua lewat WA admin, nanti saya input ke spreadsheet"**.

---

## Mode Darurat — Saat Server Down

### Langkah 0: Pastikan Master Data Up-to-date

Kalau master data (daftar pelanggan & produk) terakhir di-pull > 1 minggu lalu, **tidak masalah** — sistem akan otomatis buat pelanggan baru kalau telp belum ada. Tapi disarankan pull terbaru saat server **masih sempat online**.

### Langkah 1: Terima Laporan Kasir / Kurir

Kasir/kurir kirim via WA ke admin:
- **Nomor WA pelanggan** (kalau ada)
- **Nama pelanggan**
- **Detail item** (produk + qty + jenis: isi ulang / tukar / beli baru)
- **Metode bayar** (cash / transfer / piutang)
- **Untuk order antar**: alamat antar
- **Catatan tambahan** (opsional)

### Langkah 2: Input ke Spreadsheet

#### A. Transaksi POS (di depot)

1. Menu **🪣 DEPOT GNR → 📝 Tambah Transaksi POS**
2. Sidebar muncul di kanan:
   - **Pelanggan**: pilih dari dropdown (cari nama/telp). Kalau pelanggan baru / walk-in → biarkan kosong + isi nama manual.
   - **Tambah Item**: pilih produk → pilih jenis → isi qty. Klik **+ Tambah Item** untuk item lain.
   - **Metode bayar**: cash / transfer / piutang.
   - **Catatan**: opsional.
   - Klik **💾 Simpan ke Sheet**.
3. Data masuk ke sheet `Transaksi_Pending` dengan status `pending`.

#### B. Order Antar (kurir)

1. Menu **🪣 DEPOT GNR → 🚚 Tambah Order Antar**
2. Sama dengan POS, **plus alamat antar wajib**.
3. **Status bayar**: `belum` (default — pelanggan bayar saat barang sampai) atau `sudah` kalau pelanggan sudah transfer dulu.
4. Klik **💾 Simpan**. Data masuk ke `Order_Pending`.

#### C. Pelanggan Baru

Kalau pelanggan benar-benar baru (tidak ada di Master_Pelanggan):

1. Menu **🪣 DEPOT GNR → 👤 Tambah Pelanggan Baru**
2. Isi nama (wajib), telp, alamat, tipe (`umum` / `langganan`).
3. Klik **💾 Simpan**.

> **Catatan**: kalau di form transaksi/order kamu tulis nomor telp pelanggan baru, **server akan otomatis bikin pelanggan saat sync** — jadi langkah C ini opsional kalau telpnya sudah ada di transaksi.

### Langkah 3: Cek Dashboard

Buka sheet **Dashboard** (tab paling kanan). Lihat:
- Berapa transaksi pending
- Berapa order pending
- Omzet hari ini (estimasi dari sheet)

Kalau angka `#ERROR!` atau tidak update, klik **🪣 DEPOT GNR → 🔁 Refresh Dashboard**.

### Langkah 4: Salah Input? Hapus Baris

Selama status masih `pending`:
- Klik kanan nomor baris → **Delete row**
- Atau cukup edit nilai di kolom yang salah, lalu re-save manual.

**Setelah `synced` jangan hapus** — kalau memang harus dikoreksi, lakukan koreksi di aplikasi setelah pulih (refund / void).

---

## Saat Server Pulih — Push Pending

1. Cek status: **🪣 DEPOT GNR → 📊 Cek Status Server** → harus 🟢
2. Klik **🪣 DEPOT GNR → 🔄 Push Semua Pending ke Server**
3. Tunggu beberapa detik. Popup muncul: `X synced, Y duplikat, Z error`
4. Lihat sheet `Transaksi_Pending` / `Order_Pending` / `Pelanggan_Baru`:
   - Kolom **Status Sync**: `pending` → `synced` (atau `skipped` kalau duplikat).
   - Kolom **Sync At**: timestamp sync.
   - Kolom **Error**: kalau ada error, baca di sini.

### Apa yang terjadi di server?

- **Idempoten**: kalau nomor nota/order sama persis sudah ada → di-`skipped` (`reason: duplicate`). Aman dijalankan ulang.
- **Stok**: otomatis berkurang sesuai item.
- **Pelanggan**: kalau telp belum ada di server, otomatis dibuat (nama dari form, telp dari form).
- **Loyalty**: poin otomatis ditambah (1% dari total).
- **Bonus kurir** (untuk order antar): di-record best-effort.
- **Audit**: semua transaksi hasil sync diberi tag `[SYNC-SHEET]` di catatan supaya bisa dilacak.

### Kalau Ada Row Error

Buka sheet `Status_Log` → cari baris dengan `aksi=push`, `hasil=error` → kolom **Detail** isinya respons server. Common error:
- **Unauthorized**: secret tidak match → re-set lewat **⚙️ Set API Secret**.
- **Items invalid**: JSON di kolom Items rusak → hapus baris itu, input ulang lewat form.
- **Telp duplikat tapi nama beda**: konflik data → koreksi nama manual di sheet, push ulang.

---

## Sekali Seminggu (Maintenance)

- **Pull master data** (kalau pelanggan/produk berubah di app): **🪣 DEPOT GNR → ⬇️ Pull Master Data**
- **Backup sheet** (opsional): **File → Make a copy** → simpan dengan nama berisi tanggal.
- **Cek baris yang masih `pending` lebih dari 7 hari** — jangan sampai keteteran.

---

## Troubleshooting Cepat

| Masalah | Solusi |
|---|---|
| Dashboard isi `#ERROR!` di semua sel | Menu → **🔁 Refresh Dashboard** |
| Form dropdown pelanggan/produk kosong | Menu → **⬇️ Pull Master Data** |
| "Tidak bisa kontak server" saat push | Cek status server dulu, kalau 🟢 cek ulang internet |
| "Sync gagal — Unauthorized" | Set ulang secret lewat **⚙️ Set API Secret** |
| Salah pilih metode bayar di baris pending | Edit langsung di cell kolom **Metode Bayar**, lalu push |
| Tidak sengaja input duplikat | Push aja — yang kedua akan otomatis di-`skipped: duplicate` |
| Spreadsheet lambat / lag | Buka **Status_Log** → hapus baris log lama (>1 bulan) |

---

## Checklist Harian (Print & Tempel)

**Pagi (sebelum buka depot)**
- [ ] Cek status server (🟢 atau 🔴)

**Selama jam operasional (kalau server 🔴)**
- [ ] Terima laporan kasir/kurir lewat WA
- [ ] Input ke spreadsheet (transaksi / order / pelanggan)
- [ ] Cek dashboard berkala (jumlah pending sesuai laporan)

**Saat server pulih**
- [ ] Cek status server (harus 🟢)
- [ ] **Push Semua Pending ke Server**
- [ ] Cek hasil sync di popup
- [ ] Buka aplikasi di browser → verifikasi 2-3 transaksi random masuk dengan benar

**Sore (tutup)**
- [ ] Pastikan semua pending sudah `synced` (kalau server pulih)
- [ ] Catat di `Status_Log` kalau ada masalah yang perlu diingat besok
