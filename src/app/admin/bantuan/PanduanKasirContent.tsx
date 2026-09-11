"use client";

import {
  Sunrise,
  ShoppingCart,
  Truck,
  Wallet,
  Printer,
  FileQuestion,
  Users,
  IdCard,
  Package,
  Coins,
  Bike,
  AlertTriangle,
} from "lucide-react";
import { GuideSection, GuideGroup } from "./BantuanShared";

/**
 * Panduan Kasir — dipakai di 2 tempat:
 *   /admin/bantuan tab "Panduan Kasir" (admin bisa lihat untuk training staff)
 *   /kasir/bantuan (kasir akses langsung)
 */
export function PanduanKasirContent() {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <FileQuestion size={20} className="text-blue-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-bold text-blue-900">Panduan Kasir — Cara Pakai Fitur</div>
            <p className="text-blue-800 mt-1">
              Panduan singkat semua fitur yang bisa Anda pakai sehari-hari. Klik section
              untuk detail. Kalau ada yang tidak dibahas atau butuh bantuan, kabari admin.
            </p>
          </div>
        </div>
      </div>

      <GuideGroup label="Mulai kerja" count={1}>
        <GuideSection
          icon={<Sunrise size={18} />}
          title="1. Sebelum mulai kerja: buka shift"
          description="Wajib buka shift dulu sebelum bisa input transaksi POS atau order antar."
          openUrl="/kasir/shift"
          defaultOpen
        >
          <p>Setiap kasir wajib <strong>buka shift</strong> sebelum mulai jualan. Fungsi shift:</p>
          <ul className="list-disc pl-5">
            <li>Track siapa yang jaga kasir + jam kerja</li>
            <li>Record saldo kas awal → akhir → cek selisih (kalau ada)</li>
            <li>Semua transaksi Anda terkait shift ini untuk laporan</li>
          </ul>
          <p><strong>Cara buka shift:</strong></p>
          <ol className="list-decimal pl-5">
            <li>Buka menu <strong>Shift Kasir</strong> di sidebar</li>
            <li>Tap <strong>Buka Shift</strong></li>
            <li>Input <strong>Saldo Kas Awal</strong> — uang tunai yang ada di laci kasir sekarang</li>
            <li>Tap <strong>Konfirmasi</strong> → shift terbuka, siap terima transaksi</li>
          </ol>
          <p className="text-xs text-[color:var(--muted)]">
            Kalau lupa buka shift lalu langsung input transaksi → sistem akan warning "Belum buka shift kasir".
          </p>
        </GuideSection>
      </GuideGroup>

      <GuideGroup label="Transaksi harian" count={4}>
        <GuideSection
          icon={<ShoppingCart size={18} />}
          title="2. POS Kasir — pelanggan datang ke depot"
          description="Input transaksi walk-in cepat: pilih produk, qty, bayar."
          openUrl="/kasir/pos"
        >
          <p>Halaman <strong>POS Kasir</strong> untuk transaksi cepat pelanggan yang datang langsung ke depot (tidak antar).</p>
          <p><strong>Alur:</strong></p>
          <ol className="list-decimal pl-5">
            <li>Pilih pelanggan (opsional — kalau tidak ada, jadi "Walk-in")</li>
            <li>Pilih produk (Galon 19L Isi Ulang, Tukar, dll)</li>
            <li>Input <strong>qty</strong> (jumlah galon)</li>
            <li>Pilih <strong>metode bayar</strong>: Cash / Transfer / QRIS / Loyalty</li>
            <li>Tap <strong>Simpan Transaksi</strong> → langsung tuntas + print nota</li>
          </ol>
          <p><strong>Tips:</strong></p>
          <ul className="list-disc pl-5">
            <li>Kalau pelanggan pakai loyalty → sistem otomatis kurangi saldo</li>
            <li>Kalau pelanggan bawa galon kosong (isi ulang) → sistem catat mutasi galon otomatis</li>
            <li>Kalau ada bonus stamp → notif "Selamat! Anda dapat bonus"</li>
          </ul>
        </GuideSection>

        <GuideSection
          icon={<Truck size={18} />}
          title="3. Order Antar — kelola pengantaran"
          description="Terima order pelanggan (via web/APK) atau input walk-in dengan alamat antar."
          openUrl="/kasir/order"
        >
          <p>Halaman <strong>Order Antar</strong> menampilkan order yang perlu di-proses (antar galon ke pelanggan).</p>
          <p><strong>Tab:</strong></p>
          <ul className="list-disc pl-5">
            <li><strong>Aktif</strong> — order belum selesai atau belum lunas (butuh action)</li>
            <li><strong>pending / diproses / dijemput / diisi / diantar</strong> — filter per status</li>
            <li><strong>selesai</strong> — sudah selesai antar (baik lunas maupun piutang)</li>
            <li><strong>Tuntas</strong> — sudah selesai <strong>DAN</strong> sudah lunas (fully closed)</li>
          </ul>
          <p><strong>Alur assign kurir:</strong></p>
          <ol className="list-decimal pl-5">
            <li>Klik card order pending</li>
            <li>Pilih kurir dari dropdown "Kurir"</li>
            <li>Status otomatis pindah ke <strong>diproses</strong></li>
            <li>Kurir buka HP → lihat order muncul di <strong>Mode Kurir</strong> mereka</li>
            <li>Kurir tap "Mulai Tracking" → antar → upload bukti foto antar → tap "Selesai"</li>
            <li>Pelanggan bayar → Anda tap <strong>Konfirmasi Lunas</strong> di order tersebut</li>
          </ol>
          <p>Tombol <strong>+ Order Baru (Walk-in)</strong> di kanan atas untuk input order antar dari kasir langsung (pelanggan telpon, dll).</p>
        </GuideSection>

        <GuideSection
          icon={<Wallet size={18} />}
          title="4. Pembayaran & piutang"
          description="Verify bukti transfer dari pelanggan + konfirmasi COD/piutang lunas."
          openUrl="/pembayaran"
        >
          <p>Halaman <strong>Pembayaran</strong> menampilkan 2 hal:</p>
          <ul className="list-disc pl-5">
            <li><strong>Menunggu verifikasi</strong> — pelanggan sudah upload bukti transfer, cek + approve</li>
            <li><strong>Piutang</strong> — order sudah antar tapi belum lunas (menunggu bayar)</li>
          </ul>
          <p><strong>Cara verify bukti transfer:</strong></p>
          <ol className="list-decimal pl-5">
            <li>Klik card "Menunggu verifikasi"</li>
            <li>Lihat foto bukti transfer + nominal</li>
            <li>Cek rekening bank Anda apakah masuk (bandingkan nominal + jam)</li>
            <li>Tap <strong>Approve</strong> kalau match, atau <strong>Tolak</strong> + alasan kalau tidak match (pelanggan dapat notif untuk upload ulang)</li>
          </ol>
          <p><strong>Cara konfirmasi piutang lunas:</strong></p>
          <ol className="list-decimal pl-5">
            <li>Pelanggan datang bayar (atau transfer)</li>
            <li>Buka order tersebut → tap <strong>Konfirmasi Lunas</strong></li>
            <li>Status berubah jadi Tuntas → masuk laporan keuangan</li>
          </ol>
        </GuideSection>

        <GuideSection
          icon={<Printer size={18} />}
          title="5. Print nota via Bluetooth (RPP02N + generic ESC/POS)"
          description="Setup printer thermal + cetak nota otomatis di HP APK."
          badge="Baru"
          openUrl="/pengaturan-printer"
        >
          <p><strong>Setup pertama (sekali):</strong></p>
          <ol className="list-decimal pl-5">
            <li>Nyalakan printer thermal (contoh RPP02N)</li>
            <li>Buka Settings HP → Bluetooth → Pair new device → pilih printer → PIN <kbd>0000</kbd> atau <kbd>1234</kbd></li>
            <li>Buka menu <strong>Pengaturan Printer</strong> di app</li>
            <li>Pilih <strong>Ukuran kertas</strong>: 58mm (paling umum) atau 80mm</li>
            <li>Tap <strong>Cari Printer Paired</strong> → izinkan Bluetooth → pilih printer Anda</li>
            <li>Tap <strong>Test Print</strong> → cek keluar nota contoh</li>
          </ol>
          <p><strong>Print nota real:</strong></p>
          <ol className="list-decimal pl-5">
            <li>Buka nota (dari POS transaksi selesai atau Order Antar)</li>
            <li>Tap tombol biru <strong>Print Bluetooth</strong></li>
            <li>Nota langsung print ke printer default Anda</li>
          </ol>
          <p className="text-xs text-[color:var(--muted)]">
            Kalau print gagal: cek printer nyala + baterai HP tidak low + jarak &lt;5m dari printer.
          </p>
        </GuideSection>
      </GuideGroup>

      <GuideGroup label="Beda 2 halaman" count={1}>
        <GuideSection
          icon={<FileQuestion size={18} />}
          title="6. Riwayat Transaksi vs Order Antar — apa bedanya?"
          description="Sering bingung. Ini penjelasan lengkap."
          defaultOpen
        >
          <p><strong>2 halaman ini beda fungsi + beda source data:</strong></p>
          <ul className="list-disc pl-5">
            <li><strong>Order Antar</strong> = manajemen operasional (queue kurir, tracking, follow-up piutang)</li>
            <li><strong>Riwayat Transaksi</strong> = laporan keuangan (record final yang sudah masuk uang)</li>
          </ul>
          <p><strong>Contoh kasus:</strong></p>
          <ul className="list-disc pl-5">
            <li>Pelanggan A datang beli 2 galon cash di depot → langsung masuk <strong>Riwayat Transaksi</strong>, tidak ada di Order Antar (karena bukan antar)</li>
            <li>Pelanggan B order via WA, kurir antar 5 galon, pelanggan cash saat kurir tiba → masuk <strong>Order Antar</strong> (status Tuntas) <strong>DAN</strong> <strong>Riwayat Transaksi</strong></li>
            <li>Pelanggan C order antar 3 galon, sudah diantar tapi bayar minggu depan (piutang) → masuk <strong>Order Antar</strong> (tab <strong>Aktif</strong>) tapi <strong>BELUM</strong> di Riwayat Transaksi</li>
          </ul>
          <p><strong>Kapan pakai yang mana:</strong></p>
          <ul className="list-disc pl-5">
            <li>Mau follow up "kurir belum antar" atau "pelanggan piutang" → <strong>Order Antar</strong></li>
            <li>Mau tahu "omzet hari ini" atau cetak nota ulang → <strong>Riwayat Transaksi</strong></li>
            <li>Mau cek "piutang saya berapa" → <strong>Pembayaran</strong> tab Piutang</li>
          </ul>
        </GuideSection>
      </GuideGroup>

      <GuideGroup label="Pelanggan & langganan" count={3}>
        <GuideSection
          icon={<Users size={18} />}
          title="7. Data pelanggan"
          description="Cari, tambah baru, edit kontak."
          openUrl="/data-pelanggan"
        >
          <p>List semua pelanggan (walk-in + terdaftar). Fitur:</p>
          <ul className="list-disc pl-5">
            <li>Search by nama/telp</li>
            <li>Filter tipe: umum vs langganan</li>
            <li>Klik pelanggan → detail: riwayat, loyalty, galon dipinjam, alamat</li>
            <li>Tombol <strong>+ Tambah Pelanggan</strong> untuk input baru (walk-in yang belum daftar)</li>
          </ul>
          <p>Kalau pelanggan minta lihat riwayat mereka, buka detail → tab Riwayat Transaksi.</p>
        </GuideSection>

        <GuideSection
          icon={<IdCard size={18} />}
          title="8. Verifikasi Langganan (view-only untuk kasir)"
          description="Kasir bisa lihat pengajuan, tapi verify harus lewat admin."
          openUrl="/kasir/langganan-pending"
          badge="Baru"
        >
          <p>Pelanggan bisa ajukan jadi <strong>langganan</strong> (pinjam galon depot) dengan upload KTP dari halaman profil mereka.</p>
          <p>Sebagai kasir, Anda <strong>bisa lihat</strong> pengajuan (foto KTP + data) tapi <strong>tidak bisa Verify/Reject</strong>. Verify tetap harus lewat admin.</p>
          <p><strong>Alur:</strong></p>
          <ol className="list-decimal pl-5">
            <li>Buka menu <strong>Verifikasi Langganan</strong> di sidebar</li>
            <li>Lihat card pengajuan pending + foto KTP</li>
            <li>Kalau ada pelanggan yang tanya "sudah di-approve belum?" → Anda bisa cek status di sini</li>
            <li>Kalau perlu di-approve segera → WA admin untuk verify</li>
          </ol>
          <p><strong>List langganan verified</strong> ada di menu <strong>List Langganan</strong> — tampilkan semua langganan aktif + limit galon.</p>
        </GuideSection>

        <GuideSection
          icon={<Package size={18} />}
          title="9. Galon Dipinjam"
          description="Cek berapa galon depot di pelanggan tertentu."
          openUrl="/kasir/galon-dipinjam"
        >
          <p>Halaman ini list pelanggan yang sedang <strong>pegang galon depot</strong> (bukan galon mereka sendiri).</p>
          <p>Berguna untuk:</p>
          <ul className="list-disc pl-5">
            <li>Pelanggan tanya "galon depot saya berapa?"</li>
            <li>Follow up pelanggan yang pegang galon lama tapi tidak order</li>
            <li>Rekap saat tutup toko</li>
          </ul>
          <p>Klik pelanggan → detail mutasi (kapan pinjam, kapan return, siapa yang catat).</p>
        </GuideSection>
      </GuideGroup>

      <GuideGroup label="Tutup shift & kurir" count={2}>
        <GuideSection
          icon={<Coins size={18} />}
          title="10. Tutup shift"
          description="Wajib sebelum pulang. Input saldo kas akhir + selisih."
          openUrl="/kasir/shift"
        >
          <p>Sebelum pulang wajib tutup shift supaya laporan akurat.</p>
          <p><strong>Cara:</strong></p>
          <ol className="list-decimal pl-5">
            <li>Buka menu <strong>Shift Kasir</strong></li>
            <li>Cek daftar transaksi shift Anda + total kas masuk</li>
            <li>Hitung fisik uang tunai di laci kasir</li>
            <li>Input <strong>Saldo Kas Akhir</strong> (nominal yang sebenarnya ada)</li>
            <li>Tap <strong>Tutup Shift</strong></li>
            <li>Kalau ada <strong>selisih</strong> (kas fisik ≠ hitungan sistem), sistem tandai untuk audit admin</li>
          </ol>
          <p className="text-xs text-[color:var(--muted)]">
            Kalau ada selisih besar, kabari admin sebelum tutup — mungkin ada transaksi yang kelewatan atau salah input.
          </p>
        </GuideSection>

        <GuideSection
          icon={<Bike size={18} />}
          title="11. Mode Kurir (kalau kasir merangkap antar)"
          description="Buka order Anda sebagai kurir, tracking live, upload bukti antar."
          openUrl="/kurir"
        >
          <p>Kalau Anda juga bertugas antar galon:</p>
          <ol className="list-decimal pl-5">
            <li>Buka menu <strong>Mode Kurir</strong></li>
            <li>List order yang di-assign ke Anda muncul</li>
            <li>Buka order → cek alamat pelanggan + telp</li>
            <li>Tap <strong>Mulai Tracking</strong> → izinkan location "Allow all the time" (satu kali) → notifikasi persistent muncul di status bar</li>
            <li>Berangkat antar. Pelanggan bisa lihat posisi Anda realtime.</li>
            <li>Sampai di lokasi → antar galon → foto bukti → tap <strong>Selesai Antar</strong></li>
            <li>Kalau pelanggan bayar cash → tap <strong>Konfirmasi Lunas</strong> juga</li>
          </ol>
          <p><strong>Battery tips:</strong> tracking pakai ~2-3% baterai per jam. Kalau HP low, colok charger portable saat antar.</p>
        </GuideSection>
      </GuideGroup>

      <GuideGroup label="Troubleshooting" count={1}>
        <GuideSection
          icon={<AlertTriangle size={18} />}
          title="12. Troubleshoot umum"
          description="Solusi cepat untuk masalah yang sering terjadi."
        >
          <p><strong>Printer tidak connect:</strong></p>
          <ul className="list-disc pl-5">
            <li>Cek printer nyala + baterai printer tidak habis</li>
            <li>Cek printer sudah paired via Settings HP → Bluetooth</li>
            <li>Jarak &lt; 5 meter dari HP</li>
            <li>Restart Bluetooth HP (off → on)</li>
          </ul>
          <p><strong>Order tidak muncul:</strong></p>
          <ul className="list-disc pl-5">
            <li>Cek tab filter di atas (mungkin salah tab)</li>
            <li>Cek range tanggal (default Hari Ini)</li>
            <li>Reload halaman (tarik ke bawah untuk refresh)</li>
          </ul>
          <p><strong>Notif WA tidak masuk:</strong></p>
          <ul className="list-disc pl-5">
            <li>Bisa jadi WA bot depot Anda disconnect — kabari admin untuk scan ulang QR</li>
            <li>Cek settings HP → Notifikasi → Depot Air → Allow</li>
          </ul>
          <p><strong>Login gagal (5x salah password):</strong></p>
          <ul className="list-disc pl-5">
            <li>Rate limit 15 menit setelah 5x fail — tunggu 15 menit terus coba lagi</li>
            <li>Kalau tetap gagal, kabari admin untuk reset password Anda</li>
          </ul>
          <p><strong>Kurir tracking berhenti sendiri:</strong></p>
          <ul className="list-disc pl-5">
            <li>Battery optimization HP (MIUI/Realme/OPPO paling agresif)</li>
            <li>Settings → Battery → Depot Air → <strong>No restriction</strong> + <strong>Autostart ON</strong></li>
          </ul>
          <p className="text-xs text-[color:var(--muted)]">
            Kalau masalah tidak selesai dengan langkah di atas, kabari admin dengan info: menu apa yang dibuka, error apa yang muncul (screenshot bagus), jam kejadian.
          </p>
        </GuideSection>
      </GuideGroup>
    </div>
  );
}
