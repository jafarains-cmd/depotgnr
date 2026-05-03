"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer, Send, MessageCircle, ArrowLeft, FileDown, Ban } from "lucide-react";
import Link from "next/link";
import { kirimNotaWA, kirimNotaTelegramKePelanggan, getNotaText, batalkanTransaksi } from "./actions";

export function NotaActions({
  trxId,
  pelangganTelp,
  pelangganUserId,
  voided = false,
  canVoid = false,
  ageDays = 0,
}: {
  trxId: number;
  pelangganTelp: string | null;
  pelangganUserId: string | null;
  voided?: boolean;
  canVoid?: boolean;
  ageDays?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [waNomor, setWaNomor] = useState(pelangganTelp ?? "");
  const [showWA, setShowWA] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [voidAlasan, setVoidAlasan] = useState("");
  const overAge = ageDays > 30;

  function handleShareWALink() {
    startTransition(async () => {
      const text = await getNotaText(trxId);
      const target = (waNomor || pelangganTelp || "").replace(/[^\d]/g, "");
      const phone = target.startsWith("0") ? `62${target.slice(1)}` : target;
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Link
          href="/kasir/transaksi"
          className="text-sm text-[color:var(--muted)] hover:text-brand-700 inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Kembali
        </Link>
      </div>

      <div className="bg-surface border border-line rounded-2xl p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => window.print()}
            className="py-2 bg-slate-800 text-white rounded-md text-sm inline-flex items-center justify-center gap-1.5"
          >
            <Printer size={14} /> Cetak
          </button>
          <button
            onClick={() => window.print()}
            className="py-2 border border-line rounded-md text-sm inline-flex items-center justify-center gap-1.5"
            title="Pakai dialog cetak browser → Save as PDF"
          >
            <FileDown size={14} /> Save PDF
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowWA((v) => !v)}
            className="py-2 bg-emerald-600 text-white rounded-md text-sm inline-flex items-center justify-center gap-1.5"
          >
            <Send size={14} /> Kirim WA
          </button>
          <button
            disabled={pending || !pelangganUserId}
            onClick={() =>
              startTransition(async () => {
                const r = await kirimNotaTelegramKePelanggan(trxId);
                setMsg({ ok: r.ok, text: r.ok ? "Terkirim ke Telegram pelanggan." : r.error ?? "Gagal" });
              })
            }
            className="py-2 bg-blue-500 text-white rounded-md text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
            title={pelangganUserId ? "Kirim via bot ke Telegram pelanggan" : "Pelanggan belum hubungkan Telegram"}
          >
            <MessageCircle size={14} /> Kirim Telegram
          </button>
        </div>

        {showWA && (
          <div className="border-t pt-2 space-y-2">
            <input
              type="text"
              value={waNomor}
              onChange={(e) => setWaNomor(e.target.value)}
              placeholder="08xxxxxxxxxx"
              className="w-full px-3 py-1.5 border border-line rounded-md text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleShareWALink}
                disabled={pending || !waNomor.trim()}
                className="py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs disabled:opacity-50"
                title="Buka WhatsApp dengan teks nota (user bisa edit & kirim)"
              >
                Buka di WhatsApp
              </button>
              <button
                onClick={() =>
                  startTransition(async () => {
                    const r = await kirimNotaWA(trxId, waNomor);
                    setMsg({ ok: r.ok, text: r.ok ? "Terkirim via bot." : r.error ?? "Gagal" });
                  })
                }
                disabled={pending || !waNomor.trim()}
                className="py-1.5 bg-emerald-600 text-white rounded-md text-xs disabled:opacity-50"
                title="Kirim langsung via bot WA (Fonnte/Wablas)"
              >
                Kirim via Bot
              </button>
            </div>
          </div>
        )}

        {msg && (
          <div className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</div>
        )}

        {canVoid && !voided && (
          <div className="border-t border-line pt-2">
            {!showVoid ? (
              <button
                onClick={() => setShowVoid(true)}
                disabled={overAge}
                className="w-full py-2 border border-red-200 text-red-600 rounded-md text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
                title={overAge ? "Transaksi > 30 hari, tidak bisa dibatalkan" : ""}
              >
                <Ban size={13} />
                {overAge ? "Tidak bisa dibatalkan (>30 hari)" : "Batalkan Transaksi"}
              </button>
            ) : (
              <div className="space-y-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-xs font-bold text-red-700">
                  Batalkan Transaksi
                </div>
                <div className="text-[11px] text-red-600">
                  Transaksi akan ditandai BATAL. Loyalty pelanggan akan
                  dikurangi & stok galon dikembalikan. Tidak bisa di-undo.
                </div>
                <textarea
                  value={voidAlasan}
                  onChange={(e) => setVoidAlasan(e.target.value)}
                  placeholder="Alasan pembatalan (mis: salah input qty)"
                  rows={2}
                  className="w-full px-2 py-1.5 border border-red-200 rounded-md text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setShowVoid(false);
                      setVoidAlasan("");
                    }}
                    className="py-1.5 border border-line rounded-md text-xs"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm("Yakin batalkan transaksi ini?")) return;
                      startTransition(async () => {
                        const r = await batalkanTransaksi(trxId, voidAlasan);
                        if ("error" in r) {
                          setMsg({ ok: false, text: r.error });
                        } else {
                          setMsg({ ok: true, text: "Transaksi dibatalkan." });
                          setTimeout(() => router.refresh(), 600);
                        }
                      });
                    }}
                    disabled={pending || voidAlasan.trim().length < 3}
                    className="py-1.5 bg-red-600 text-white rounded-md text-xs disabled:opacity-50"
                  >
                    Konfirmasi Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
