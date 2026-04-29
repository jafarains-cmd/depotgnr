import { db } from "@/db";
import { PageHeader } from "@/components/AppShell";
import { savePengaturan } from "./actions";
import { PengaturanForm } from "./PengaturanForm";
import { TelegramWebhook } from "./TelegramWebhook";
import { SheetsSync } from "./SheetsSync";
import { QrisUploader } from "./QrisUploader";

export const dynamic = "force-dynamic";

const FIELDS: { key: string; label: string; type?: "text" | "textarea"; help?: string }[] = [
  { key: "namaDepot", label: "Nama Depot" },
  { key: "alamatDepot", label: "Alamat Depot", type: "textarea" },
  { key: "telpDepot", label: "Telp Depot" },
  {
    key: "templateNotifOrderMasukAdmin",
    label: "Template Notif Order Masuk (untuk Admin)",
    type: "textarea",
    help: "Placeholder: {nomorOrder}, {namaPelanggan}, {jumlahItem}, {totalEstimasi}, {alamatAntar}",
  },
  {
    key: "templateNotifOrderSelesaiPelanggan",
    label: "Template Notif Order Selesai (untuk Pelanggan)",
    type: "textarea",
    help: "Placeholder: {nomorOrder}, {total}, {namaDepot}",
  },
  {
    key: "telegramGroupChatId",
    label: "Telegram Group Chat ID",
    help: "ID grup (negatif, mis. -100xxxxxxx). Pakai /chatid di grup lewat bot. Kosongkan = kirim DM admin pakai env.",
  },
  {
    key: "telegramTopicSemua",
    label: "Topic ID — Semua Orderan",
    help: "Pakai /topicid di topic 'Semua Orderan' lewat bot. Kosongkan kalau grup tanpa topic.",
  },
  { key: "telegramTopicPending", label: "Topic ID — Pending" },
  { key: "telegramTopicDiproses", label: "Topic ID — Diproses" },
  { key: "telegramTopicDiantar", label: "Topic ID — Diantar" },
  { key: "telegramTopicSelesai", label: "Topic ID — Selesai" },
  { key: "telegramTopicBatal", label: "Topic ID — Batal" },
  {
    key: "appsScriptUrl",
    label: "Apps Script Web App URL",
    help: "URL hasil deploy Apps Script (lihat docs/apps-script.gs untuk panduan).",
  },
  {
    key: "appsScriptToken",
    label: "Apps Script Token",
    help: "Token rahasia yang sama persis dengan TOKEN di Apps Script kamu.",
  },
  {
    key: "driveFolderBuktiKurir",
    label: "Drive Folder ID — Bukti Pengantaran Kurir",
    help: "ID folder Google Drive untuk simpan foto bukti antar. Buka folder di Drive → ID = bagian terakhir URL (drive.google.com/drive/folders/<ID>).",
  },
  {
    key: "driveFolderBuktiBayar",
    label: "Drive Folder ID — Bukti Pembayaran",
    help: "Folder Drive terpisah untuk bukti pembayaran (boleh sama dengan bukti antar). Format ID sama.",
  },
  {
    key: "qrisFotoUrl",
    label: "URL Gambar QRIS Statis",
    help: "Upload gambar QRIS depot ke Drive (set sharing 'anyone with link'), lalu paste URL view-nya. Atau pakai format https://drive.google.com/uc?id=<FILE_ID>.",
  },
  {
    key: "nomorDana",
    label: "Nomor DANA",
    help: "Nomor HP yang terdaftar di akun DANA depot. Akan ditampilkan ke pelanggan saat pilih bayar via DANA.",
  },
  {
    key: "atasNamaDana",
    label: "Atas Nama DANA",
    help: "Nama pemilik akun DANA (untuk verifikasi pelanggan).",
  },
  {
    key: "daftarRekening",
    label: "Daftar Rekening Bank",
    type: "textarea",
    help: "Satu rekening per baris. Format: BANK | NOMOR | ATAS NAMA. Contoh: BCA | 1234567890 | Depot Air",
  },
  {
    key: "aktifkanStampGalon",
    label: "Aktifkan Bonus Stamp Galon",
    help: "Isi 1 untuk aktif, 0 untuk nonaktif. Setiap kelipatan stamp threshold, pelanggan dapat saldo loyalty.",
  },
  {
    key: "stampThresholdGalon",
    label: "Threshold Stamp Galon",
    help: "Berapa galon untuk dapat 1 reward (default: 10).",
  },
  {
    key: "nilaiGalonGratis",
    label: "Nilai 1 Galon Gratis (Rp)",
    help: "Saldo loyalty yang ditambahkan saat pelanggan capai threshold (default: 5000).",
  },
];

export default async function PengaturanPage() {
  const all = await db.query.pengaturan.findMany();
  const map = Object.fromEntries(all.map((r) => [r.key, r.value ?? ""]));

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <PageHeader title="Pengaturan" description="Konfigurasi depot, template pesan, dan integrasi." />
      <QrisUploader currentUrl={map.qrisFotoUrl ?? null} />
      <PengaturanForm fields={FIELDS} values={map} action={savePengaturan} />
      <TelegramWebhook />
      <SheetsSync />
    </div>
  );
}
