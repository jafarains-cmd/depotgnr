import { PageHeader } from "@/components/AppShell";
import { BantuanClient } from "./BantuanClient";
import { SetupTeknisContent } from "./SetupTeknisContent";

export default function BantuanPage() {
  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <PageHeader
        title="Bantuan"
        description="Panduan penggunaan (admin + kasir) dan setup teknis integrasi."
      />
      <BantuanClient setupContent={<SetupTeknisContent />} defaultTab="admin" />
    </div>
  );
}
