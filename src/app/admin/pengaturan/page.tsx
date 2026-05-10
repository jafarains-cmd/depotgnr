import Link from "next/link";
import { Building2, Megaphone, CreditCard, Gift, Bell, Plug, Cloud, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { backupLog } from "@/db/schema/backup";
import { PageHeader } from "@/components/AppShell";
import { savePengaturan } from "./actions";
import { PengaturanForm } from "./PengaturanForm";
import { TelegramWebhook } from "./TelegramWebhook";
import { SheetsSync } from "./SheetsSync";
import { QrisUploader } from "./QrisUploader";
import { ZONA_OPTIONS } from "@/lib/timezone";

export const dynamic = "force-dynamic";

type Field = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "select";
  help?: string;
  options?: { value: string; label: string }[];
};

const ALL_FIELDS: Record<string, Field> = {
  namaDepot: { key: "namaDepot", label: "Nama Depot" },
  alamatDepot: { key: "alamatDepot", label: "Alamat Depot", type: "textarea" },
  telpDepot: { key: "telpDepot", label: "Telp Depot" },
  footerNota: {
    key: "footerNota",
    label: "Footer Nota",
    type: "textarea",
    help: "Teks penutup di bawah nota cetak. Default: 'Terima kasih atas kunjungan Anda 🙏'.",
  },
  zonaWaktu: {
    key: "zonaWaktu",
    label: "Zona Waktu",
    type: "select",
    options: ZONA_OPTIONS,
    help: "Zona waktu lokal depot. Dipakai untuk format tanggal/jam di seluruh aplikasi.",
  },

  heroBadge: {
    key: "heroBadge",
    label: "Hero · Badge (atas judul)",
    help: "Default: 'SEGAR TIAP HARI'. Ditampilkan di card hero halaman beranda pelanggan.",
  },
  heroTitle: {
    key: "heroTitle",
    label: "Hero · Judul",
    type: "textarea",
    help: "Default: 'Stok air keluarga aman dalam 30 menit.' Pakai 1-2 baris.",
  },
  heroSubtitle: {
    key: "heroSubtitle",
    label: "Hero · Subtitle",
    type: "textarea",
    help: "Default: 'Pesan galon isi ulang dari depot terdekat. Antar cepat, harga jujur.'",
  },
  heroCta: { key: "heroCta", label: "Hero · Tombol CTA", help: "Default: 'Pesan sekarang'." },

  promoAktif: {
    key: "promoAktif",
    label: "Tampilkan Banner Promo Pelanggan Baru",
    type: "select",
    options: [
      { value: "1", label: "Aktif (tampilkan banner)" },
      { value: "0", label: "Nonaktif (sembunyikan)" },
    ],
    help: "Banner promo di landing page (sebelum login). Set ke nonaktif saat tidak ada promo.",
  },
  promoBadge: {
    key: "promoBadge",
    label: "Promo · Badge",
    help: "Default: '★ Pelanggan Baru ★'. Teks kecil di atas judul promo.",
  },
  promoTitle: {
    key: "promoTitle",
    label: "Promo · Judul",
    type: "textarea",
    help: "Default: 'Bonus Rp 5.000 untuk Daftar Hari Ini'. Bisa multi-baris.",
  },
  promoSubtitle: {
    key: "promoSubtitle",
    label: "Promo · Subtitle",
    type: "textarea",
    help: "Default: 'Saldo loyalty otomatis masuk...'. Detail benefit promo.",
  },
  promoCta: {
    key: "promoCta",
    label: "Promo · Tombol CTA",
    help: "Default: 'Klaim Bonus Saya'. Teks di tombol action.",
  },

  templateNotifOrderMasukAdmin: {
    key: "templateNotifOrderMasukAdmin",
    label: "Template Notif Order Masuk (untuk Admin)",
    type: "textarea",
    help: "Placeholder: {nomorOrder}, {namaPelanggan}, {jumlahItem}, {totalEstimasi}, {alamatAntar}",
  },
  templateNotifOrderSelesaiPelanggan: {
    key: "templateNotifOrderSelesaiPelanggan",
    label: "Template Notif Order Selesai (untuk Pelanggan)",
    type: "textarea",
    help: "Placeholder: {nomorOrder}, {total}, {namaDepot}",
  },

  telegramGroupChatId: {
    key: "telegramGroupChatId",
    label: "Telegram Group Chat ID",
    help: "ID grup (negatif, mis. -100xxxxxxx). Pakai /chatid di grup. Kosongkan = DM admin pakai env.",
  },
  telegramTopicSemua: {
    key: "telegramTopicSemua",
    label: "Topic ID — Semua Orderan",
    help: "Pakai /topicid di topic 'Semua Orderan'. Kosongkan kalau grup tanpa topic.",
  },
  telegramTopicPending: { key: "telegramTopicPending", label: "Topic ID — Pending" },
  telegramTopicDiproses: { key: "telegramTopicDiproses", label: "Topic ID — Diproses" },
  telegramTopicDiantar: { key: "telegramTopicDiantar", label: "Topic ID — Diantar" },
  telegramTopicSelesai: { key: "telegramTopicSelesai", label: "Topic ID — Selesai" },
  telegramTopicBatal: { key: "telegramTopicBatal", label: "Topic ID — Batal" },

  appsScriptUrl: {
    key: "appsScriptUrl",
    label: "Apps Script Web App URL",
    help: "URL hasil deploy Apps Script (lihat docs/apps-script.gs untuk panduan).",
  },
  appsScriptToken: {
    key: "appsScriptToken",
    label: "Apps Script Token",
    help: "Token rahasia yang sama persis dengan TOKEN di Apps Script.",
  },
  driveFolderBuktiKurir: {
    key: "driveFolderBuktiKurir",
    label: "Drive Folder ID — Bukti Pengantaran Kurir",
    help: "ID folder Google Drive untuk simpan foto bukti antar. ID = bagian terakhir URL folder Drive.",
  },
  driveFolderBuktiBayar: {
    key: "driveFolderBuktiBayar",
    label: "Drive Folder ID — Bukti Pembayaran",
    help: "Folder Drive terpisah (boleh sama dengan bukti antar).",
  },
  driveFolderBackup: {
    key: "driveFolderBackup",
    label: "Drive Folder ID — Backup Database",
    help: "Folder khusus untuk backup database harian (.db.gz). Kalau kosong, fallback ke folder Bukti Pembayaran.",
  },

  qrisFotoUrl: {
    key: "qrisFotoUrl",
    label: "URL Gambar QRIS Statis",
    help: "Otomatis terisi setelah upload via tombol di atas. Atau paste URL Drive manual.",
  },
  nomorDana: {
    key: "nomorDana",
    label: "Nomor DANA",
    help: "Nomor HP yang terdaftar di akun DANA depot.",
  },
  atasNamaDana: { key: "atasNamaDana", label: "Atas Nama DANA" },
  daftarRekening: {
    key: "daftarRekening",
    label: "Daftar Rekening Bank",
    type: "textarea",
    help: "Satu rekening per baris. Format: BANK | NOMOR | ATAS NAMA. Contoh: BCA | 1234567890 | Depot Air",
  },

  aktifkanBonusKurir: {
    key: "aktifkanBonusKurir",
    label: "Aktifkan Bonus Kurir",
    help: "Isi 1 untuk aktif, 0 untuk nonaktif.",
  },
  bonusKurirPerGalon: {
    key: "bonusKurirPerGalon",
    label: "Bonus Kurir per Galon (Rp)",
    help: "Default: 500.",
  },
  tampilkanBonusKeKurir: {
    key: "tampilkanBonusKeKurir",
    label: "Tampilkan Bonus ke Kurir/Kasir",
    help: "1=kurir lihat saldo bonus di dashboard, 0=disembunyikan.",
  },
  loyaltiPerGalonAntar: {
    key: "loyaltiPerGalonAntar",
    label: "Loyalti per Galon — Antar (Rp)",
    help: "Default: 250.",
  },
  loyaltiPerGalonDepot: {
    key: "loyaltiPerGalonDepot",
    label: "Loyalti per Galon — Datang ke Depot (Rp)",
    help: "Default: 500.",
  },
  nilaiReferralBonus: {
    key: "nilaiReferralBonus",
    label: "Bonus Referral (Rp)",
    help: "Saldo untuk referee + referrer saat referee selesaikan order pertama (default: 5000).",
  },
  aktifkanStampGalon: {
    key: "aktifkanStampGalon",
    label: "Aktifkan Bonus Stamp Galon",
    help: "Isi 1 untuk aktif. PERINGATAN: kalau loyalti per galon juga aktif, akan double bonus.",
  },
  stampThresholdGalon: {
    key: "stampThresholdGalon",
    label: "Threshold Stamp Galon",
    help: "Default: 10.",
  },
  nilaiGalonGratis: {
    key: "nilaiGalonGratis",
    label: "Nilai 1 Galon Gratis Stamp (Rp)",
    help: "Default: 5000.",
  },
};

type Tab = {
  id: string;
  label: string;
  icon: React.ReactNode;
  fieldKeys: string[];
};

const TABS: Tab[] = [
  {
    id: "depot",
    label: "Depot",
    icon: <Building2 size={14} />,
    fieldKeys: ["namaDepot", "alamatDepot", "telpDepot", "footerNota", "zonaWaktu"],
  },
  {
    id: "tampilan",
    label: "Tampilan",
    icon: <Megaphone size={14} />,
    fieldKeys: [
      "heroBadge",
      "heroTitle",
      "heroSubtitle",
      "heroCta",
      "promoAktif",
      "promoBadge",
      "promoTitle",
      "promoSubtitle",
      "promoCta",
    ],
  },
  {
    id: "pembayaran",
    label: "Pembayaran",
    icon: <CreditCard size={14} />,
    fieldKeys: ["qrisFotoUrl", "nomorDana", "atasNamaDana", "daftarRekening"],
  },
  {
    id: "loyalty",
    label: "Loyalty & Bonus",
    icon: <Gift size={14} />,
    fieldKeys: [
      "loyaltiPerGalonAntar",
      "loyaltiPerGalonDepot",
      "nilaiReferralBonus",
      "aktifkanStampGalon",
      "stampThresholdGalon",
      "nilaiGalonGratis",
      "aktifkanBonusKurir",
      "bonusKurirPerGalon",
      "tampilkanBonusKeKurir",
    ],
  },
  {
    id: "notifikasi",
    label: "Notifikasi",
    icon: <Bell size={14} />,
    fieldKeys: [
      "templateNotifOrderMasukAdmin",
      "templateNotifOrderSelesaiPelanggan",
      "telegramGroupChatId",
      "telegramTopicSemua",
      "telegramTopicPending",
      "telegramTopicDiproses",
      "telegramTopicDiantar",
      "telegramTopicSelesai",
      "telegramTopicBatal",
    ],
  },
  {
    id: "integrasi",
    label: "Integrasi",
    icon: <Plug size={14} />,
    fieldKeys: [
      "appsScriptUrl",
      "appsScriptToken",
      "driveFolderBuktiKurir",
      "driveFolderBuktiBayar",
      "driveFolderBackup",
    ],
  },
];

export default async function PengaturanPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const activeTab = TABS.find((t) => t.id === tabParam) ?? TABS[0];

  const all = await db.query.pengaturan.findMany();
  const map = Object.fromEntries(all.map((r) => [r.key, r.value ?? ""]));

  // Status backup terakhir
  const [lastBackup] = await db
    .select()
    .from(backupLog)
    .orderBy(desc(backupLog.ranAt))
    .limit(1);

  const fields = activeTab.fieldKeys.map((k) => ALL_FIELDS[k]).filter(Boolean);

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-4">
      <PageHeader
        title="Pengaturan"
        description="Konfigurasi depot, template pesan, dan integrasi."
      />

      {/* Status backup */}
      <BackupStatusBanner backup={lastBackup} />

      {/* Tab nav */}
      <div className="flex gap-1.5 flex-wrap border-b border-line pb-2 -mx-1">
        {TABS.map((t) => {
          const isActive = t.id === activeTab.id;
          return (
            <Link
              key={t.id}
              href={`/admin/pengaturan?tab=${t.id}`}
              className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
                isActive
                  ? "bg-brand text-white"
                  : "bg-surface border border-line text-[color:var(--muted)] hover:text-ink"
              }`}
            >
              {t.icon}
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab.id === "pembayaran" && (
        <QrisUploader currentUrl={map.qrisFotoUrl ?? null} />
      )}

      <PengaturanForm fields={fields} values={map} action={savePengaturan} />

      {activeTab.id === "notifikasi" && <TelegramWebhook />}
      {activeTab.id === "integrasi" && <SheetsSync />}
    </div>
  );
}

function BackupStatusBanner({
  backup,
}: {
  backup:
    | {
        status: "success" | "failed";
        ranAt: Date;
        sizeBytes: number | null;
        fileUrl: string | null;
        error: string | null;
        triggeredBy: "manual" | "cron";
      }
    | undefined;
}) {
  if (!backup) {
    return (
      <Link
        href="/admin/backup"
        className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 hover:border-amber-400 transition"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold text-amber-900 inline-flex items-center gap-1.5">
              <AlertTriangle size={16} /> Belum ada backup database
            </div>
            <p className="text-xs text-amber-800 mt-1">
              Database belum pernah di-backup. Klik untuk backup manual atau setup
              cron timer.
            </p>
          </div>
          <span className="text-xs text-amber-900 font-bold inline-flex items-center gap-1">
            Buka Backup <ExternalLink size={11} />
          </span>
        </div>
      </Link>
    );
  }

  const sukses = backup.status === "success";
  const sizeMb = backup.sizeBytes
    ? (backup.sizeBytes / 1024 / 1024).toFixed(2)
    : "-";
  const ageHours = Math.floor((Date.now() - backup.ranAt.getTime()) / 3600000);
  const stale = ageHours > 30; // > ~1 hari + buffer

  return (
    <div
      className={`rounded-2xl p-4 border ${
        sukses && !stale
          ? "bg-emerald-50 border-emerald-200"
          : sukses && stale
            ? "bg-amber-50 border-amber-200"
            : "bg-rose-50 border-rose-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div
            className={`font-bold inline-flex items-center gap-1.5 ${
              sukses ? (stale ? "text-amber-900" : "text-emerald-900") : "text-rose-900"
            }`}
          >
            {sukses ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {sukses
              ? stale
                ? "Backup terakhir > 30 jam lalu"
                : "Backup database aktif"
              : "Backup database GAGAL"}
          </div>
          <div
            className={`text-xs mt-1 ${
              sukses ? (stale ? "text-amber-800" : "text-emerald-800") : "text-rose-800"
            }`}
          >
            {sukses ? (
              <>
                <Cloud size={11} className="inline mr-1" />
                Terakhir berhasil di-upload ke Google Drive:{" "}
                <strong>
                  {backup.ranAt.toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </strong>{" "}
                · {sizeMb} MB · trigger {backup.triggeredBy}
              </>
            ) : (
              <>
                Error: {backup.error ?? "tidak diketahui"}. Cek pengaturan
                Apps Script & folder Drive di tab Integrasi.
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {backup.fileUrl && (
            <a
              href={backup.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand font-bold inline-flex items-center gap-1 hover:underline whitespace-nowrap"
            >
              File <ExternalLink size={11} />
            </a>
          )}
          <Link
            href="/admin/backup"
            className="text-xs font-bold inline-flex items-center gap-1 px-3 py-1.5 bg-surface border border-line rounded-md hover:border-brand whitespace-nowrap"
          >
            History →
          </Link>
        </div>
      </div>
    </div>
  );
}
