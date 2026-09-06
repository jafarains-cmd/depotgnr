import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireRole } from "@/lib/permissions";
import { PageHeader } from "@/components/AppShell";
import { WhatsAppStatusClient } from "./WhatsAppStatusClient";

export const dynamic = "force-dynamic";

export default async function WhatsAppStatusPage() {
  await requireRole(["admin"]);

  const provider = process.env.WHATSAPP_PROVIDER ?? "fonnte";
  const apiUrl = process.env.WHATSAPP_API_URL ?? "";
  const hasKey = !!process.env.WHATSAPP_API_KEY;
  const keyPreview = hasKey ? `${process.env.WHATSAPP_API_KEY!.slice(0, 4)}...${process.env.WHATSAPP_API_KEY!.slice(-4)}` : null;

  // Ambil grup ID yang di-configure untuk quick reference
  const [waGroupOrder, waGroupLangganan] = await Promise.all([
    db.query.pengaturan.findFirst({ where: eq(pengaturan.key, "waGroupOrderMasuk") }),
    db.query.pengaturan.findFirst({ where: eq(pengaturan.key, "waGroupLangganan") }),
  ]);

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <PageHeader
        title="Status WhatsApp API"
        description="Cek koneksi provider WA + test kirim pesan."
      />
      <WhatsAppStatusClient
        env={{
          provider,
          apiUrl,
          hasKey,
          keyPreview,
        }}
        groups={{
          orderMasuk: waGroupOrder?.value?.trim() || null,
          langganan: waGroupLangganan?.value?.trim() || null,
        }}
      />
    </div>
  );
}
