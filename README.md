# Depot Air Minum Isi Ulang

Aplikasi manajemen depot air minum isi ulang — POS kasir, order online, inventory galon, integrasi Telegram & WhatsApp, plus sinkronisasi Google Sheets.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **TailwindCSS** untuk UI
- **Drizzle ORM** + **SQLite** (better-sqlite3)
- **Better Auth** (email/username/WhatsApp OTP)
- **grammy** untuk bot Telegram
- **react-leaflet** + **@vis.gl/react-google-maps** untuk peta pelanggan

## Fitur Utama

- **3 role**: admin, kasir, pelanggan — tiap role punya halaman & permission sendiri.
- **POS kasir** dengan cart, pelanggan picker, 3 metode bayar, cetak nota / save PDF.
- **Order online** untuk pelanggan, status tracking realtime.
- **Inventory galon** dengan tracking 3 status (terisi/kosong/rusak) + log mutasi.
- **Laporan** harian/bulanan dengan grafik dan breakdown produk.
- **Bot Telegram** dengan command `/start`, `/status`, `/order`, plus integrasi grup dengan topic per status.
- **Bot WhatsApp** untuk order via chat (Fonnte/Wablas) + OTP login + notif.
- **Google Sheets** 2 arah via Apps Script Web App (tanpa service account).
- **Peta pelanggan** dengan Google Maps (auto-fallback ke OpenStreetMap).
- **Pelanggan bisa batal order** sendiri saat status masih `pending`.

## Setup Singkat

```bash
# 1. Clone & install
git clone https://github.com/<user>/<repo>.git
cd <repo>
npm install

# 2. Setup env
cp .env.example .env.local
# Edit .env.local — minimal isi BETTER_AUTH_SECRET & DATABASE_URL

# 3. Setup database
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:create-admin -- admin@depot.local Password123 "Admin"

# 4. Jalankan
npm run dev
# Buka http://localhost:3000
```

## Panduan Lengkap

Setelah login admin, buka menu **Bantuan** di sidebar untuk panduan setup integrasi:

- Google Sheets (Apps Script)
- Bot Telegram + grup dengan topic
- WhatsApp (Fonnte/Wablas)
- Google Maps (opsional)
- Backup database

## Deploy ke Produksi

**Panduan lengkap fresh install di server baru:** [docs/INSTALASI.md](docs/INSTALASI.md)

Atau install otomatis (Ubuntu 22.04+):

```bash
# Clone repo dulu, lalu:
sudo bash scripts/install.sh
```

Script akan:
- Install Node.js 20 + build tools
- Bikin user `depot`
- Clone repo + build
- Bikin `.env.local` dengan secret auto-generated
- Setup database + admin pertama
- Setup systemd service
- Setup symlink `depot-update` untuk update gampang

Setelah itu masih perlu setup manual (lihat INSTALASI.md):
- Cloudflare Tunnel untuk HTTPS gratis
- Apps Script untuk upload foto + backup ke Drive
- Pengaturan aplikasi via `/admin/pengaturan`

## Lisensi

Private / internal use.
