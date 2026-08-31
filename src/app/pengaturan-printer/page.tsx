import { PrinterSettingsClient } from "./PrinterSettingsClient";

export const dynamic = "force-static";

export default function PengaturanPrinterPage() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-2">Pengaturan Printer</h1>
      <p className="text-sm text-[color:var(--muted)] mb-6">
        Pengaturan printer thermal Bluetooth per HP ini. Setting tidak
        tersimpan di server — beda HP beda config.
      </p>
      <PrinterSettingsClient />
    </div>
  );
}
