# Panduan Setup Spreadsheet Cadangan

Spreadsheet cadangan untuk catat transaksi/order saat aplikasi `depot.genster.my.id` down. Admin (1 orang) input di Sheet → sync otomatis ke aplikasi saat server pulih.

> **Sudah setup? Lihat [CARA-PAKAI-SPREADSHEET-CADANGAN.md](CARA-PAKAI-SPREADSHEET-CADANGAN.md)** untuk panduan pemakaian harian.

---

## Langkah Setup (1x saja, sekitar 15 menit)

### 1. Setting Server: Generate SHEET_SYNC_SECRET

Di server Proxmox:

```bash
# Generate random secret (32 karakter)
openssl rand -hex 16
# Contoh output: a3f2c4b8d9e1f0a5b6c7d8e9f0a1b2c3
```

Tambah ke file `.env.local` di server:

```bash
sudo nano /opt/depot-air/.env.local
```

Tambah baris:
```
SHEET_SYNC_SECRET=a3f2c4b8d9e1f0a5b6c7d8e9f0a1b2c3
```

Restart service:
```bash
sudo systemctl restart depot-air.service
```

### 2. Buat Spreadsheet Baru

1. Buka https://sheets.google.com (pakai akun **owner depot**)
2. Klik **+ Blank** → ganti nama jadi **"DEPOT GNR — Cadangan"**

### 3. Pasang Apps Script

1. Di Spreadsheet, klik menu **Extensions → Apps Script**
2. Tab editor terbuka. Hapus semua code default.
3. Buka file [docs/apps-script-cadangan.gs](apps-script-cadangan.gs) dari repo → copy seluruh isi → paste ke editor.
4. **Tambah file HTML untuk form**:
   - Klik tombol **+** di sidebar kiri → **HTML** → beri nama `FormTransaksi`
   - Copy isi [docs/apps-script-cadangan-FormTransaksi.html](apps-script-cadangan-FormTransaksi.html) → paste
   - Ulangi untuk `FormOrder` (dari `apps-script-cadangan-FormOrder.html`)
   - Ulangi untuk `FormPelanggan` (dari `apps-script-cadangan-FormPelanggan.html`)
5. Klik **Save** (ikon disket atau Ctrl+S)
6. Tutup tab Apps Script
7. Kembali ke Spreadsheet → **Reload** halaman (F5)

### 4. Setup Awal di Spreadsheet

Setelah reload, menu **"🪣 DEPOT GNR"** muncul di toolbar atas.

1. Klik **🪣 DEPOT GNR → 🧰 Setup Awal (Buat Sheet)**
   - Apps Script minta izin pertama kali: klik **Review permissions** → pilih akun → **Advanced** → **Go to ... (unsafe)** → **Allow**
   - Sheet baru otomatis dibuat: `Transaksi_Pending`, `Order_Pending`, `Pelanggan_Baru`, `Status_Log`, `Master_Pelanggan`, `Master_Produk`, `Dashboard`

2. Klik **🪣 DEPOT GNR → ⚙️ Set API Secret**
   - Paste secret yang sama dengan yang diset di server `SHEET_SYNC_SECRET`
   - Klik OK

3. Klik **🪣 DEPOT GNR → 📊 Cek Status Server**
   - Harus muncul "🟢 Server ONLINE"
   - Kalau merah, cek koneksi atau server status

4. Klik **🪣 DEPOT GNR → ⬇️ Pull Master Data**
   - Sheet `Master_Pelanggan` & `Master_Produk` terisi dengan data dari server
   - Form input akan pakai data ini untuk dropdown

### 5. (Opsional) Share ke Admin Lain

Kalau ada lebih dari 1 admin yang perlu akses:
1. Klik tombol **Share** di kanan atas Spreadsheet
2. Pilih: **Anyone with link** → Editor (atau add email specific admin)
3. Akun yang akses harus pakai email Google yang sama untuk akses Apps Script

---

## Cara Pakai (saat aplikasi down)

### Input Transaksi POS

1. Buka Spreadsheet
2. Cek status: **🪣 DEPOT GNR → 📊 Cek Status Server**
3. Klik **🪣 DEPOT GNR → 📝 Tambah Transaksi POS**
4. Sidebar muncul kanan:
   - Pilih pelanggan dari dropdown (atau biarkan Walk-in)
   - Tambah item (produk + qty)
   - Total auto-hitung
   - Pilih metode bayar
   - Klik **💾 Simpan ke Sheet**
5. Data masuk ke sheet `Transaksi_Pending` dengan status `pending`

### Input Order Antar

Sama, klik **🚚 Tambah Order Antar**. Plus isi alamat antar.

### Input Pelanggan Baru

Klik **👤 Tambah Pelanggan Baru**. Nama wajib, telp & alamat opsional.

---

## Saat Aplikasi Recover (Push ke Server)

1. Cek status: **🪣 DEPOT GNR → 📊 Cek Status Server** → harus 🟢
2. Klik **🪣 DEPOT GNR → 🔄 Push Semua Pending ke Server**
3. Konfirmasi muncul: "X transaksi, Y order, Z pelanggan synced"
4. Status di sheet berubah `pending` → `synced` + timestamp

### Apa yang terjadi di server saat sync?

- **Idempoten**: kalau nomor nota/order sudah ada di server, di-skip (status = `skipped`, reason = `duplicate`)
- **Pelanggan auto-create**: kalau telp pelanggan belum ada di server, otomatis dibuat
- **Stok dikurangi normal**: sama dengan POS biasa
- **Loyalty earn + bonus kurir** trigger best-effort
- **Audit**: catatan tersimpan dengan prefix `[SYNC-SHEET]`

---

## Dashboard

Sheet **Dashboard** otomatis isi statistik:
- Berapa transaksi/order pending sync
- Berapa total sudah tersync
- Omzet hari ini (dari data di sheet)

---

## Troubleshooting

**"❌ Server offline"** padahal server up:
- Cek `SHEET_SYNC_SECRET` di script properties match dengan env server
- Cek server bisa diakses dari Apps Script (Google ke `depot.genster.my.id` di port 443)

**"Sync gagal — Unauthorized"**:
- Secret di Apps Script & server tidak sama
- Re-set lewat **🪣 DEPOT GNR → ⚙️ Set API Secret**

**Items di form gak muncul**:
- Pull master data dulu: **🪣 DEPOT GNR → ⬇️ Pull Master Data**

**Duplikat nomor nota saat sync**:
- Sistem otomatis skip — status `skipped`, reason `duplicate`. Aman.

---

## Catatan Penting

- **Hanya admin** yang boleh input (jangan share ke kasir)
- **Stok di server** akan turun saat sync — jangan double-input di app + sheet untuk transaksi yang sama
- **Hapus row di sheet manual** kalau salah input (sebelum push). Setelah `synced` jangan dihapus (audit trail).
- **Log audit** ada di sheet `Status_Log` untuk troubleshoot
