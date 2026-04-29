import { db } from "@/db";
import { PageHeader } from "@/components/AppShell";
import { savePengaturan } from "./actions";
import { PengaturanForm } from "./PengaturanForm";
import { TelegramWebhook } from "./TelegramWebhook";
import { SheetsSync } from "./SheetsSync";

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
];

export default async function PengaturanPage() {
  const all = await db.query.pengaturan.findMany();
  const map = Object.fromEntries(all.map((r) => [r.key, r.value ?? ""]));

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title="Pengaturan" description="Konfigurasi depot, template pesan, dan integrasi." />
      <PengaturanForm fields={FIELDS} values={map} action={savePengaturan} />
      <TelegramWebhook />
      <SheetsSync />
    </div>
  );
}
