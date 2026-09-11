import { PageHeader } from "@/components/AppShell";
import { PanduanKasirContent } from "@/app/admin/bantuan/PanduanKasirContent";

export default function KasirBantuanPage() {
  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <PageHeader
        title="Bantuan Kasir"
        description="Panduan cara pakai fitur untuk kasir. Klik section untuk detail."
      />
      <PanduanKasirContent />
    </div>
  );
}
