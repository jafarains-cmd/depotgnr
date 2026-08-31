"use client";

import { useEffect, useState, useTransition } from "react";
import { Printer, X, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/components/Toast";
import {
  isCapacitorNative,
  getThermalPrefs,
  setThermalPrinter,
  listPairedPrinters,
  printBytes,
  type PairedDevice,
} from "@/lib/thermal-print";
import { notaToEscpos, type NotaData } from "@/lib/nota-to-escpos";

/**
 * Tombol print thermal Bluetooth. Cuma render di Capacitor native APK
 * (di browser web → return null, biar tetap pakai window.print() existing).
 *
 * Kalau printer belum di-set → modal pilih printer paired dulu, save default.
 * Kalau sudah → langsung print.
 */
export function PrintThermalButton({
  nota,
  className = "",
  label = "Print Bluetooth",
}: {
  nota: NotaData;
  className?: string;
  label?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [currentPrinter, setCurrentPrinter] = useState<{
    address: string | null;
    name: string | null;
  }>({ address: null, name: null });
  const toast = useToast();

  useEffect(() => {
    setMounted(true);
    const prefs = getThermalPrefs();
    setCurrentPrinter({ address: prefs.address, name: prefs.name });
  }, []);

  if (!mounted || !isCapacitorNative()) return null;

  async function openPicker() {
    setLoading(true);
    setShowPicker(true);
    try {
      const list = await listPairedPrinters();
      setDevices(list);
      if (list.length === 0) {
        toast.error(
          "Belum ada printer paired. Buka Settings HP → Bluetooth → Pair dengan printer thermal dulu.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal load printer list");
      setShowPicker(false);
    } finally {
      setLoading(false);
    }
  }

  function selectPrinter(d: PairedDevice) {
    setThermalPrinter(d.address, d.name);
    setCurrentPrinter({ address: d.address, name: d.name });
    setShowPicker(false);
    toast.success(`Printer default: ${d.name}`);
  }

  async function doPrint() {
    if (!currentPrinter.address) {
      openPicker();
      return;
    }
    startTransition(async () => {
      try {
        const prefs = getThermalPrefs();
        const bytes = notaToEscpos(nota, prefs.paperSize);
        await printBytes(bytes);
        toast.success("Nota terkirim ke printer");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal print");
      }
    });
  }

  return (
    <>
      <button
        onClick={doPrint}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 disabled:opacity-50 transition ${className}`}
      >
        <Printer size={16} />
        {pending ? "Printing..." : label}
      </button>
      {currentPrinter.name && (
        <button
          onClick={openPicker}
          className="text-[11px] text-[color:var(--muted)] hover:text-brand ml-2 inline-flex items-center gap-1"
          title="Ganti printer"
        >
          <Printer size={11} /> {currentPrinter.name}
        </button>
      )}

      {showPicker && (
        <div
          className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="bg-surface rounded-2xl p-4 max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold">Pilih Printer Bluetooth</div>
              <button
                onClick={() => setShowPicker(false)}
                className="text-[color:var(--muted)]"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-[color:var(--muted)] mb-3">
              Pilih printer yang sudah di-pair via Settings HP → Bluetooth.
              Printer akan disimpan sebagai default untuk semua print berikutnya.
            </p>
            {loading ? (
              <div className="text-center py-6 text-sm text-[color:var(--muted)]">
                Loading printer list...
              </div>
            ) : devices.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 inline-flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <div>
                  Belum ada printer paired.
                  <br />
                  Buka <b>Settings HP → Bluetooth</b> → nyalakan printer → tap
                  &quot;Pair new device&quot; → pilih printer thermal Anda.
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {devices.map((d) => {
                  const isCurrent = d.address === currentPrinter.address;
                  return (
                    <button
                      key={d.address}
                      onClick={() => selectPrinter(d)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition ${
                        isCurrent
                          ? "border-brand bg-brand-soft"
                          : "border-line hover:border-brand"
                      }`}
                    >
                      <div className="text-left min-w-0 flex-1">
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
        </div>
      )}
    </>
  );
}
