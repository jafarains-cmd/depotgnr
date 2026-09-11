"use client";

import {
  LayoutDashboard,
  Sunrise,
  BarChart3,
  Users,
  Truck,
  Boxes,
  Wallet,
  Gift,
  Wrench,
  Bell,
  Building2,
} from "lucide-react";
import { GuideSection, GuideGroup } from "./BantuanShared";

/**
 * Panduan Admin — cara pakai fitur harian untuk role admin.
 * Bukan setup teknis (itu di tab Setup). Fokus workflow operasional.
 */
export function PanduanAdminContent() {
  return (
    <div className="space-y-6">
      <div className="bg-brand-soft border border-brand-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <LayoutDashboard size={20} className="text-brand flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-bold text-brand">Panduan Admin — Cara Pakai Harian</div>
            <p className="text-[color:var(--muted)] mt-1">
              Section di bawah dapat diklik untuk buka detail. Fokus pada workflow harian
              admin: buka shift, cek dashboard, follow up piutang, verifikasi langganan, dll.
            </p>
          </div>
        </div>
      </div>

      <GuideGroup label="Mulai" count={2}>
        <GuideSection
          icon={<Sunrise size={18} />}
          title="1. Ringkasan sistem"
          description="Apa itu Depot Air Minum GNR, role, dan alur data."
        >
          <p>
            Depot Air Minum GNR adalah aplikasi manajemen depot air isi ulang. Ada <strong>4 role</strong>:
          </p>
          <ul className="list-disc pl-5">
            <li><strong>Admin</strong> — Anda. Akses penuh: laporan, konfigurasi, verifikasi.</li>
            <li><strong>Kasir</strong> — proses transaksi POS, order antar, shift kas.</li>
            <li><strong>Kurir</strong> — antar galon + tracking live posisi.</li>
            <li><strong>Pelanggan</strong> — order via web/APK, riwayat, loyalty.</li>
          </ul>
          <p>Alur data tipikal:</p>
          <ol className="list-decimal pl-5">
            <li>Pelanggan order (web/APK) atau kasir input walk-in</li>
            <li>Kurir di-assign, antar galon, upload bukti antar</li>
            <li>Pelanggan bayar (cash/transfer/piutang)</li>
            <li>Sistem catat ke <code>transaksi</code> untuk laporan keuangan</li>
            <li>Bonus loyalty untuk pelanggan + bonus kurir otomatis dihitung</li>
          </ol>
        </GuideSection>

        <GuideSection
          icon={<Sunrise size={18} />}
          title="2. Rutinitas harian admin"
          description="Yang perlu Anda cek tiap pagi + sebelum tutup."
        >
          <p><strong>Pagi (10-15 menit):</strong></p>
          <ol className="list-decimal pl-5">
            <li>Buka <code>/admin/dashboard</code> → cek metric hari sebelumnya vs target</li>
            <li>Cek badge merah di sidebar — biasanya ada:
              <ul className="list-disc pl-5">
                <li><strong>Order Antar</strong> — order pending yang belum di-proses</li>
                <li><strong>Pembayaran</strong> — bukti transfer yang menunggu verifikasi</li>
                <li><strong>Verifikasi Langganan</strong> — pengajuan KTP baru</li>
                <li><strong>Langganan Inaktif</strong> — pelanggan pegang galon &gt;30 hari tidak order</li>
                <li><strong>Komplain</strong> — komplain baru dari pelanggan</li>
              </ul>
            </li>
            <li>Follow up alert prioritas tertinggi dulu</li>
          </ol>
          <p><strong>Sore/tutup:</strong></p>
          <ol className="list-decimal pl-5">
            <li>Cek <code>/admin/laporan/cash-flow</code> — omzet hari ini + piutang outstanding</li>
            <li>Reminder kasir tutup shift sebelum pulang</li>
            <li>Cek <code>/admin/laporan/penjualan</code> untuk rekap harian</li>
          </ol>
        </GuideSection>
      </GuideGroup>

      <GuideGroup label="Monitoring & Laporan" count={2}>
        <GuideSection
          icon={<LayoutDashboard size={18} />}
          title="3. Dashboard admin"
          description="Ringkasan metric bisnis realtime."
          openUrl="/admin/dashboard"
        >
          <p>Dashboard tampilkan:</p>
          <ul className="list-disc pl-5">
            <li><strong>Omzet</strong> — hari ini, minggu ini, bulan ini + comparison</li>
            <li><strong>Order aktif</strong> — sedang jalan (pending/diproses/diantar)</li>
            <li><strong>Piutang</strong> — total outstanding + jumlah pelanggan</li>
            <li><strong>Kurir aktif</strong> — sedang di jalan</li>
            <li><strong>Grafik penjualan</strong> — 7/30 hari terakhir</li>
            <li><strong>Top pelanggan</strong> — kontribusi terbesar</li>
          </ul>
          <p className="text-xs text-[color:var(--muted)]">
            Angka refresh otomatis tiap page reload — tidak butuh manual refresh setiap detik.
          </p>
        </GuideSection>

        <GuideSection
          icon={<BarChart3 size={18} />}
          title="4. Laporan keuangan & analitik"
          description="Penjualan, laba, cash flow, follow-up churn."
        >
          <p>Menu <strong>Laporan</strong> di sidebar berisi:</p>
          <ul className="list-disc pl-5">
            <li><strong>Penjualan</strong> — daftar transaksi + filter tanggal/kasir/sumber</li>
            <li><strong>Laba</strong> — HPP vs harga jual, laba per produk</li>
            <li><strong>Cash Flow</strong> — kas masuk vs keluar per periode</li>
            <li><strong>Order Antar</strong> — order antar khusus + status per kurir</li>
            <li><strong>Bonus Kurir</strong> — kalkulasi bonus per kurir per bulan</li>
            <li><strong>Semua</strong> — dashboard gabungan seluruh laporan</li>
          </ul>
          <p>Semua laporan support export/print + filter periode custom.</p>
          <p className="text-xs text-[color:var(--muted)]">
            Menu <strong>Follow-up</strong> tampilkan pelanggan yang biasa aktif tapi mulai jarang order (churn risk) — kontak proaktif via WA.
          </p>
        </GuideSection>
      </GuideGroup>

      <GuideGroup label="Pelanggan & Order" count={3}>
        <GuideSection
          icon={<Users size={18} />}
          title="5. Manajemen pelanggan"
          description="List, edit, tipe umum vs langganan."
          openUrl="/data-pelanggan"
        >
          <p><strong>List pelanggan</strong> tampilkan semua pelanggan (walk-in + terdaftar).</p>
          <p>Klik nama pelanggan → detail dengan:</p>
          <ul className="list-disc pl-5">
            <li>Riwayat transaksi + loyalty balance</li>
            <li>Galon depot yang sedang dipinjam</li>
            <li>Field edit kontak/alamat/koordinat peta</li>
            <li>Kalau tipe = <strong>langganan</strong>: field <strong>limit galon</strong> per akun (override default global)</li>
          </ul>
          <p><strong>Peta pelanggan</strong> (<code>/admin/peta</code>) tampilkan semua pelanggan dengan koordinat — bantu planning rute antar.</p>
        </GuideSection>

        <GuideSection
          icon={<Users size={18} />}
          title="6. Verifikasi langganan (KTP)"
          description="Approve/tolak pengajuan pelanggan jadi langganan."
          badge="Baru"
          openUrl="/admin/langganan-pending"
        >
          <p>Pelanggan bisa ajukan jadi <strong>langganan</strong> (pinjam galon depot) dengan upload foto KTP dari halaman profil mereka.</p>
          <p>Sebagai admin, Anda:</p>
          <ol className="list-decimal pl-5">
            <li>Dapat notif WA + FCM push saat pengajuan masuk</li>
            <li>Buka <code>/admin/langganan-pending</code> → lihat foto KTP + data pelanggan</li>
            <li>Cek keaslian KTP (buram? nama match? alamat masuk akal?)</li>
            <li>Tap <strong>Verify</strong> (approve) atau <strong>Tolak</strong> (input alasan yang dikirim via WA ke pelanggan)</li>
          </ol>
          <p>Setelah verified, pelanggan bisa order dengan pinjaman galon depot (default limit 5 galon).</p>
          <p><strong>Menu terkait:</strong></p>
          <ul className="list-disc pl-5">
            <li><code>/admin/langganan</code> — list semua pelanggan langganan verified</li>
            <li><code>/admin/langganan-inaktif</code> — pelanggan langganan pegang galon &gt;30 hari tidak order (butuh follow-up)</li>
          </ul>
        </GuideSection>

        <GuideSection
          icon={<Truck size={18} />}
          title="7. Kurir Live tracking"
          description="Monitor posisi kurir realtime + assign kurir."
          badge="Baru"
          openUrl="/admin/kurir-live"
        >
          <p><code>/admin/kurir-live</code> tampilkan peta OSM dengan marker semua kurir yang sedang antar (status order aktif).</p>
          <ul className="list-disc pl-5">
            <li>Marker 🛵 posisi kurir (auto-refresh 15 detik)</li>
            <li>Marker pin tujuan pelanggan + garis putus-putus jarak</li>
            <li>Badge <strong>LIVE</strong> (hijau, &lt;2 menit sync), <strong>STALE</strong> (kuning, &gt;2 menit), <strong>BELUM</strong> (abu, belum tap Mulai Tracking)</li>
            <li>Klik card di list → peta fly ke posisi kurir</li>
            <li>Tombol quick WA → follow-up ke pelanggan langsung</li>
          </ul>
          <p><strong>Kalau kurir belum LIVE:</strong> mereka lupa tap "Mulai Tracking" di HP. WA reminder atau minta staff kasir kontak.</p>
        </GuideSection>
      </GuideGroup>

      <GuideGroup label="Inventori & Kas" count={2}>
        <GuideSection
          icon={<Boxes size={18} />}
          title="8. Inventori, produk, bahan baku"
          description="Stok galon, sparepart, purchase order."
        >
          <ul className="list-disc pl-5">
            <li><strong>Produk</strong> (<code>/admin/produk</code>) — jenis galon (isi ulang, tukar, beli baru) + harga</li>
            <li><strong>Inventory</strong> (<code>/admin/inventory</code>) — stok galon + mutasi masuk/keluar</li>
            <li><strong>Pembelian</strong> (<code>/admin/inventory/pembelian</code>) — catat pembelian bahan baku / galon baru dari supplier</li>
            <li><strong>Bahan baku</strong> (<code>/admin/bahan-baku</code>) — stock air, plastik cup, dll (kalau produksi sendiri)</li>
            <li><strong>Pemeliharaan</strong> (<code>/admin/pemeliharaan</code>) — jadwal ganti sparepart RO, filter, dll</li>
          </ul>
        </GuideSection>

        <GuideSection
          icon={<Wallet size={18} />}
          title="9. Kas keluar & kategori biaya"
          description="Input pengeluaran ops (listrik, gaji, sparepart) untuk laporan laba akurat."
        >
          <p><strong>Alur:</strong></p>
          <ol className="list-decimal pl-5">
            <li>Buat kategori biaya di <code>/admin/kategori-biaya</code> (mis. "Listrik", "Gaji", "Sparepart")</li>
            <li>Input pengeluaran di <code>/admin/pengeluaran</code> — pilih kategori, tanggal, nominal, catatan</li>
            <li>Sistem otomatis integrate ke laporan cash flow + laba (revenue - HPP - pengeluaran)</li>
          </ol>
          <p>Rekonsiliasi bank di <code>/admin/rekonsiliasi</code> untuk match transaksi bank vs record app.</p>
        </GuideSection>
      </GuideGroup>

      <GuideGroup label="Loyalty, Komplain, Konfigurasi" count={4}>
        <GuideSection
          icon={<Gift size={18} />}
          title="10. Bonus & program loyalty"
          description="Cashback pelanggan, bonus kurir, referral, stamp."
        >
          <ul className="list-disc pl-5">
            <li><strong>Loyalty pelanggan</strong> — cashback Rp 250-500 per galon otomatis masuk saldo loyalty. Pelanggan bisa redeem di order berikutnya.</li>
            <li><strong>Stamp galon</strong> — setiap 10 galon dapat reward (configurable di pengaturan).</li>
            <li><strong>Bonus kurir</strong> (<code>/admin/bonus-kurir</code>) — auto-calculated per order antar. Approve/adjust bulanan.</li>
            <li><strong>Bonus staff</strong> (<code>/admin/bonus-staff</code>) — bonus referral (staff ajak pelanggan baru).</li>
            <li><strong>Referral pelanggan</strong> — kode referral otomatis per akun. Pelanggan baru pakai kode → keduanya dapat bonus.</li>
          </ul>
        </GuideSection>

        <GuideSection
          icon={<Wrench size={18} />}
          title="11. Komplain & follow-up"
          description="Terima komplain, balas, tag resolusi."
          openUrl="/admin/komplain"
        >
          <p>Pelanggan submit komplain via <code>/pelanggan/komplain</code>. Anda:</p>
          <ol className="list-decimal pl-5">
            <li>Dapat notif WA + FCM push</li>
            <li>Buka <code>/admin/komplain</code> — list dengan status (baru/diproses/selesai)</li>
            <li>Klik komplain → detail + foto + riwayat chat</li>
            <li>Balas via tombol reply → dikirim ke WA pelanggan</li>
            <li>Tag "selesai" setelah masalah beres</li>
          </ol>
        </GuideSection>

        <GuideSection
          icon={<Bell size={18} />}
          title="12. Notifikasi (WA + FCM push)"
          description="Config sender, group WA, tes koneksi."
        >
          <p><strong>WhatsApp API</strong> (Fonnte/Wablas):</p>
          <ul className="list-disc pl-5">
            <li><code>/admin/whatsapp-status</code> — cek device connect, quota, expired, test kirim</li>
            <li><code>/admin/pengaturan</code> tab <strong>Notifikasi</strong> — set Group WA untuk broadcast (order masuk, langganan pending)</li>
          </ul>
          <p><strong>FCM push (native APK):</strong></p>
          <ul className="list-disc pl-5">
            <li>Setup 1x di file <code>.env.local</code> server (kontak admin dev kalau belum aktif)</li>
            <li>Otomatis kirim ke APK user saat: order status berubah, kurir tiba, pembayaran diverifikasi</li>
          </ul>
        </GuideSection>

        <GuideSection
          icon={<Building2 size={18} />}
          title="13. Pengaturan umum & security"
          description="Nama depot, alamat, syarat langganan, dashboard security."
        >
          <p><strong>Pengaturan</strong> (<code>/admin/pengaturan</code>) — tab:</p>
          <ul className="list-disc pl-5">
            <li><strong>Umum</strong> — nama depot, alamat, telp, footer nota, hero copy landing page</li>
            <li><strong>Notifikasi</strong> — template WA, Telegram group ID, WA group ID</li>
            <li><strong>Integrasi</strong> — Apps Script URL/token, Drive folder ID</li>
            <li><strong>Langganan</strong> — default limit galon, syarat langganan, WA group khusus</li>
          </ul>
          <p><strong>Security</strong> (<code>/admin/security</code>) — dashboard:</p>
          <ul className="list-disc pl-5">
            <li>Login events 7 hari (sukses/gagal/rate-limited)</li>
            <li>IP suspicious (banyak fail login)</li>
            <li>Session insights (user multi-device, session idle lama)</li>
            <li>Env check (secret strength, VAPID key, dll)</li>
          </ul>
          <p><strong>Backup DB</strong> (<code>/admin/backup</code>) — download snapshot database + upload ke Drive.</p>
        </GuideSection>
      </GuideGroup>
    </div>
  );
}
