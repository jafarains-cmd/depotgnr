"use client";

import { useEffect, useState } from "react";
import { Printer, Bluetooth, Wifi, Check, AlertCircle, Trash2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import {
  isCapacitorNative,
  getThermalPrefs,
  setThermalPrinter,
  clearThermalPrinter,
  listPairedPrinters,
  setPaperSize,
  printBytes,
  type PairedDevice,
} from "@/lib/thermal-print";
import { notaToEscpos, type NotaData } from "@/lib/nota-to-escpos";
import type { PaperSize } from "@/lib/escpos";

const TEST_NOTA: NotaData = {
  header: { namaDepot: "DEPOT GNR", alamatDepot: "Test alamat depot", telpDepot: "08123456789" },
  dokumenLabel: "TEST PRINT",
  meta: {
    nomor: "TEST-001",
    tanggal: new Date(),
    kasirNama: "Test Kasir",
    pelangganNama: "Test Pelanggan",
  },
  items: [
    { namaProduk: "Galon Isi Ulang", qty: 2, hargaSatuan: 6000, subtotal: 12000, jenis: "isi_ulang" },
    { namaProduk: "Air RO Premium", qty: 1, hargaSatuan: 8000, subtotal: 8000, jenis: "beli_baru" },
  ],
  totals: {
    subtotal: 20000,
    diskon: 500,
    loyalti: 1500,
    total: 18000,
    metodeBayar: "cash",
    statusBayar: "lunas",
    bayar: 20000,
    kembalian: 2000,
  },
  catatan: "Ini test print. Kalau semua tampil rapi, pengaturan sudah benar.",
};

export function PrinterSettingsClient() {
  const [mounted, setMounted] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [paperSize, setSize] = useState<PaperSize>(58);
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [testing, setTesting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setMounted(true);
    const p = getThermalPrefs();
    setAddress(p.address);
    setName(p.name);
    setSize(p.paperSize);
  }, []);

  if (!mounted) return null;

  const nativeApk = isCapacitorNative();

  async function scan() {
    setScanning(true);
    try {
      const list = await listPairedPrinters();
      setDevices(list);
      if (list.length === 0) {
        toast.error(
          "Belum ada printer paired. Buka Settings HP → Bluetooth → Pair printer dulu.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal scan Bluetooth");
    } finally {
      setScanning(false);
    }
  }

  function selectPrinter(d: PairedDevice) {
    setThermalPrinter(d.address, d.name);
    setAddress(d.address);
    setName(d.name);
    toast.success(`Printer default: ${d.name}`);
  }

  function unselect() {
    clearThermalPrinter();
    setAddress(null);
    setName(null);
    toast.info("Printer default dihapus.");
  }

  function selectPaper(s: PaperSize) {
    setPaperSize(s);
    setSize(s);
    toast.success(`Ukuran kertas: ${s}mm`);
  }

  async function testPrint() {
    setTesting(true);
    try {
      const bytes = notaToEscpos(TEST_NOTA, paperSize);
      await printBytes(bytes);
      toast.success("Test print terkirim! Cek printer.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test print gagal");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      {!nativeApk && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 inline-flex items-start gap-2">
          <AlertCircle size={18} className="text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <b>Print Bluetooth cuma bisa di APK Android.</b>
            <br />
            Anda buka pengaturan ini di browser web / desktop — setting bisa
            diatur tapi tombol print tidak muncul. Install APK untuk pakai.
          </div>
        </div>
      )}

      {/* Paper size */}
      <div className="bg-surface border border-line rounded-2xl p-4">
        <div className="font-bold text-sm mb-3 inline-flex items-center gap-2">
          <Wifi size={16} className="text-brand" /> Ukuran Kertas
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[58, 80].map((s) => (
            <button
              key={s}
              onClick={() => selectPaper(s as PaperSize)}
              className={`py-3 rounded-xl border-2 transition ${
                paperSize === s
                  ? "border-brand bg-brand-soft"
                  : "border-line hover:border-brand"
              }`}
            >
              <div className="font-extrabold">{s}mm</div>
              <div className="text-[11px] text-[color:var(--muted)]">
                {s === 58 ? "32 karakter/baris" : "48 karakter/baris"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Printer default */}
      <div className="bg-surface border border-line rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-sm inline-flex items-center gap-2">
            <Bluetooth size={16} className="text-brand" /> Printer Default
          </div>
          {address && (
            <button
              onClick={unselect}
              className="text-[11px] text-rose-600 hover:underline inline-flex items-center gap-0.5"
            >
              <Trash2 size={11} /> Hapus
            </button>
          )}
        </div>

        {address ? (
          <div className="bg-brand-soft border border-brand-200 rounded-xl p-3 mb-3">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-brand" />
              <div className="font-bold text-sm">{name}</div>
            </div>
            <div className="text-[11px] text-[color:var(--muted)] font-mono mt-1">
              {address}
            </div>
          </div>
        ) : (
          <div className="text-xs text-[color:var(--muted)] mb-3">
            Belum ada printer default. Tap tombol di bawah untuk pilih.
          </div>
        )}

        {nativeApk && (
          <button
            onClick={scan}
            disabled={scanning}
            className="w-full py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Bluetooth size={14} />
            {scanning ? "Scanning..." : "Cari Printer Paired"}
          </button>
        )}

        {devices.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="text-[11px] font-bold text-[color:var(--muted)]">
              PAIRED DEVICES
            </div>
            {devices.map((d) => {
              const isCurrent = d.address === address;
              return (
                <button
                  key={d.address}
                  onClick={() => selectPrinter(d)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition ${
                    isCurrent
                      ? "border-brand bg-brand-soft"
                      : "border-line hover:border-brand"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate">{d.name}</div>
                    <div className="text-[11px] text-[color:var(--muted)] font-mono truncate">
                      {d.address}
                    </div>
                  </div>
                  {isCurrent && <Check size={16} className="text-brand" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Test print */}
      {nativeApk && address && (
        <div className="bg-surface border border-line rounded-2xl p-4">
          <div className="font-bold text-sm mb-2 inline-flex items-center gap-2">
            <Printer size={16} className="text-brand" /> Test Print
          </div>
          <p className="text-xs text-[color:var(--muted)] mb-3">
            Cetak nota contoh untuk cek printer + ukuran kertas + format sudah benar.
          </p>
          <button
            onClick={testPrint}
            disabled={testing}
            className="w-full py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {testing ? "Printing..." : "Print Nota Contoh"}
          </button>
        </div>
      )}

      {/* Cara pair */}
      <div className="bg-slate-50 border border-line rounded-2xl p-4 text-xs text-[color:var(--muted)]">
        <div className="font-bold text-slate-700 mb-1">Cara pair printer baru:</div>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Nyalakan printer thermal (RPP02N default nama seperti model)</li>
          <li>Buka Settings HP → Bluetooth → nyalakan</li>
          <li>Tap &quot;Pair new device&quot; → cari printer → pair (biasanya PIN 0000 atau 1234)</li>
          <li>Balik ke app ini → tap &quot;Cari Printer Paired&quot; → pilih printer</li>
          <li>Tap &quot;Test Print&quot; untuk verify</li>
        </ol>
      </div>
    </div>
  );
}
