# Depot Air Minum GNR — Android APK Guide

Panduan build, install, dan release APK Android via Capacitor.

## Arsitektur

APK ini adalah **wrapper WebView native** yang buka `https://depot.genster.my.id` dengan akses Capacitor plugins (background location, camera, notif native).

**Keuntungan:**
- Update code web → APK auto-pull versi terbaru (tidak perlu rebuild APK setiap update logic)
- Cuma perlu rebuild + submit ulang APK kalau ubah:
  - Capacitor plugin
  - Permission Android
  - Icon / splash screen
  - versionCode / versionName

## Cara build APK

### Cara 1: GitHub Actions (recommended — tidak perlu install Android Studio)

**Debug APK (untuk test internal):**

1. Buka https://github.com/jafarains-cmd/depotgnr/actions
2. Pilih workflow **"Build Android APK"** (sidebar kiri)
3. Klik **"Run workflow"** → pilih branch `main` → biarkan **build_type=debug** → Run
4. Tunggu ~5-10 menit
5. Setelah selesai, buka run tersebut → scroll ke bawah → download **artifact `depot-air-gnr-debug-apk`**
6. Extract ZIP → dapat file `.apk`

**Release APK (untuk Play Store — signed):**

Butuh keystore dulu (lihat section "Generate Keystore" di bawah).
Setelah keystore ada + secrets di GitHub set:
- Same steps, tapi pilih **build_type=release**
- Output: `.apk` + `.aab` (Android App Bundle untuk Play Store)

### Cara 2: Local build (kalau Anda punya Android Studio)

```bash
# Install dependencies
npm ci

# Sync Capacitor
npx cap sync android

# Buka di Android Studio
npx cap open android

# Di Android Studio:
# Build → Build Bundle(s)/APK(s) → Build APK(s)
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

Atau build CLI:
```bash
cd android
./gradlew assembleDebug
```

## Install APK ke HP

**HP Android (sideload):**

1. Download APK ke HP (via email/WA/USB)
2. Buka file `.apk` di HP → Android akan tampilkan warning "Install from unknown source"
3. Tap **Settings** → aktifkan **"Allow from this source"** untuk browser/file manager yang Anda pakai
4. Balik ke installer → tap **Install**
5. Selesai — app muncul di app drawer dengan nama "Depot Air Minum GNR"

**HP MIUI / OPPO / Realme:** ada extra step "Autostart permission" — aktifkan supaya notif + tracking jalan reliable di background.

## Generate Keystore (WAJIB untuk Release/Play Store)

**PERINGATAN:** Keystore ini SELAMANYA menandatangani app Anda. Kalau hilang, Anda tidak bisa update app di Play Store lagi (harus publish ulang dengan nama baru). **Backup ke Google Drive + hard drive external.**

```bash
# Di terminal (butuh Java installed)
keytool -genkey -v -keystore depot-release.keystore -alias depot-air -keyalg RSA -keysize 2048 -validity 25000

# Ikuti prompt:
# - Password keystore (min 6 char, contoh: "DepotGNR2026@")
# - First name / Last name / Org / dll (isi identitas depot)
# - Password key (bisa sama dengan password keystore)
```

Output: file `depot-release.keystore`. **Simpan di tempat aman, bukan di repo git!**

### Upload ke GitHub Secrets

Setelah keystore ada, upload ke GitHub sebagai secret supaya CI bisa sign APK:

1. Encode keystore ke base64:
   ```bash
   # Windows PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("depot-release.keystore")) | Out-File keystore.base64.txt

   # Mac/Linux
   base64 -i depot-release.keystore > keystore.base64.txt
   ```

2. Buka GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

3. Tambah 4 secrets:
   - `ANDROID_KEYSTORE_BASE64` — isi file `keystore.base64.txt`
   - `ANDROID_KEYSTORE_PASSWORD` — password keystore
   - `ANDROID_KEY_ALIAS` — `depot-air` (dari perintah keytool di atas)
   - `ANDROID_KEY_PASSWORD` — password key (biasanya sama dengan keystore)

4. Delete file `keystore.base64.txt` dari local (jangan commit).

Sekarang GitHub Actions bisa build release signed APK/AAB.

## Icon dan Splash Screen

**Ganti icon default:**

1. Bikin icon di Canva: **512×512 PNG** dengan background transparent, gambar galon biru + tulisan "GNR" putih
2. Bikin adaptive icon (Android 8+):
   - Foreground: 108×108 dp PNG (galon+GNR di area aman 66×66 dp tengah)
   - Background: solid color biru `#0284c7`
3. Pakai tool [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html) — upload PNG, generate semua size otomatis
4. Extract hasil ke `android/app/src/main/res/mipmap-*/`
5. Rebuild APK

**Splash screen** sudah di-config di `capacitor.config.ts`:
- Background: `#0284c7` (biru brand)
- Duration: 1.5 detik
- Auto-hide setelah web loaded

## Update APK

**Update code web** (yang paling sering):
- Push ke `main` → auto-deploy ke depot.genster.my.id
- User buka APK → auto load versi web terbaru
- **Tidak perlu rebuild APK / re-submit Play Store**

**Update Capacitor / permission / icon:**
- Update `capacitor.config.ts` atau `AndroidManifest.xml`
- Bump `versionCode` di `android/app/build.gradle` (misal 1→2)
- Bump `versionName` (misal "1.0"→"1.1")
- Push → GitHub Actions build release APK signed
- Upload AAB baru ke Play Console → publish update

## Requirements Play Store Publish

Sebelum submit ke Play Store, siapkan:

**Wajib:**
- [ ] Google Play Developer account (\$25 sekali seumur hidup) — https://play.google.com/console
- [ ] Signed release AAB (Android App Bundle)
- [ ] App icon 512×512 PNG (high-res)
- [ ] Feature graphic 1024×500 PNG (banner)
- [ ] Screenshot HP minimal 2, max 8 (bahasa Indonesia)
- [ ] Deskripsi app (short + long, bahasa Indonesia + English)
- [ ] Privacy Policy URL (bikin di https://app-privacy-policy-generator.firebaseapp.com)
- [ ] Data Safety form (deklarasi collect data lokasi + auth)
- [ ] Video demo background location (screen record 30 detik) — WAJIB karena app minta `ACCESS_BACKGROUND_LOCATION`

**Content rating:** Everyone (aplikasi manajemen bisnis, tidak ada konten dewasa)

**Kategori:** Business atau Productivity

**Waktu review Google:** 1-7 hari untuk submit pertama, lebih cepat untuk update selanjutnya.

## Troubleshooting

**"App not installed" saat install APK:**
- Uninstall dulu versi lama sebelum install versi baru (kalau di-sign dengan keystore beda)
- Cek versi Android minimum: APK ini butuh Android 6.0+

**Background tracking berhenti:**
- HP Xiaomi/Realme/OPPO: buka Settings → Battery → Battery saver → Depot Air Minum GNR → **No restriction**
- Enable "Autostart" di aturan aplikasi
- Kurir tap "Mulai Tracking" satu kali di awal shift

**Web content tidak load:**
- Cek internet HP
- Cek https://depot.genster.my.id bisa dibuka di browser HP dulu
- Kalau server down, APK juga tidak load (WebView mode)

**Notif tidak masuk:**
- Cek permission notif diaktifkan di Settings → App info → Notifications
- Cek Do Not Disturb tidak aktif
