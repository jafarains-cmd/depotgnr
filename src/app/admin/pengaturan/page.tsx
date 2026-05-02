import Link from "next/link";
import { Building2, Megaphone, CreditCard, Gift, Bell, Plug } from "lucide-react";
import { db } from "@/db";
import { PageHeader } from "@/components/AppShell";
import { savePengaturan } from "./actions";
import { PengaturanForm } from "./PengaturanForm";
import { TelegramWebhook } from "./TelegramWebhook";
import { SheetsSync } from "./SheetsSync";
import { QrisUploader } from "./QrisUploader";

export const dynamic = "force-dynamic";

type Field = { key: string; label: string; type?: "text" | "textarea"; help?: string };

const ALL_FIELDS: Record<string, Field> = {
  namaDepot: { key: "namaDepot", label: "Nama Depot" },
  alamatDepot: { key: "alamatDepot", label: "Alamat Depot", type: "textarea" },
  telpDepot: { key: "telpDepot", label: "Telp Depot" },

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
    fieldKeys: ["namaDepot", "alamatDepot", "telpDepot"],
  },
  {
    id: "tampilan",
    label: "Tampilan",
    icon: <Megaphone size={14} />,
    fieldKeys: ["heroBadge", "heroTitle", "heroSubtitle", "heroCta"],
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

  const fields = activeTab.fieldKeys.map((k) => ALL_FIELDS[k]).filter(Boolean);

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-4">
      <PageHeader
        title="Pengaturan"
        description="Konfigurasi depot, template pesan, dan integrasi."
      />

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
