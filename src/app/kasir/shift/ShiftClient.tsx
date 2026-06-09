"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Square,
  RefreshCw,
  Users,
  Clock,
  Coins,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { bukaShiftAction, tutupShiftAction, reopenShiftAction } from "./actions";
import { formatRupiah } from "@/lib/utils";

type MyShiftAktif = {
  id: number;
  openedAt: string;
  openingCash: number | null;
};

type Ringkasan = {
  openingCash: number;
  omzetCash: number;
  omzetTransfer: number;
  omzetQris: number;
  omzetOrder: number;
  jumlahTransaksi: number;
  jumlahOrder: number;
  totalPengeluaran: number;
  jumlahPengeluaran: number;
  expected: number;
};

type ShiftAktif = {
  id: number;
  kasirNama: string;
  openedAt: string;
  openingCash: number | null;
};

type ShiftHariIni = {
  id: number;
  openedAt: string;
  closedAt: string | null;
  status: string;
  openingCash: number | null;
  closingCashCounted: number | null;
  closingCashExpected: number | null;
  selisih: number | null;
  catatan: string | null;
  kasirNama: string;
  dapatReopen: boolean;
};

export function ShiftClient({
  myShiftAktif,
  ringkasanAktif,
  semuaShiftAktif,
  shiftHariIni,
  nextUrl,
  autoOpenTutup,
}: {
  myShiftAktif: MyShiftAktif | null;
  ringkasanAktif: Ringkasan | null;
  semuaShiftAktif: ShiftAktif[];
  shiftHariIni: ShiftHariIni[];
  nextUrl?: string | null;
  autoOpenTutup?: boolean;
}) {
  // Auto-open modal buka shift kalau ada nextUrl dan belum ada shift aktif
  const [openBuka, setOpenBuka] = useState(Boolean(nextUrl && !myShiftAktif));
  // Modal tutup shift TIDAK auto-open lagi — kasir manual klik tombol Tutup.
  // (Auto-open dulu memaksa kasir tutup, padahal shift malam masih wajar.)
  void autoOpenTutup;
  const [openTutup, setOpenTutup] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  function fmt(iso: string) {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function handleReopen(shiftId: number) {
    if (!confirm("Buka kembali shift ini? (hanya boleh dalam 30 menit setelah tutup)")) return;
    setMsg(null);
    startTransition(async () => {
      const r = await reopenShiftAction(shiftId);
      if ("error" in r) setMsg(`❌ ${r.error}`);
      else {
        setMsg("✅ Shift di-buka kembali");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className="bg-[color:var(--surface2)] border border-line rounded p-2 text-sm">
          {msg}
        </div>
      )}

      {/* Shift aktif saya */}
      {myShiftAktif ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-bold tracking-widest text-emerald-800">
                SHIFT AKTIF
              </div>
              <div className="text-lg font-extrabold text-emerald-900 mt-0.5 inline-flex items-center gap-1.5">
                <Clock size={16} /> Sejak {fmt(myShiftAktif.openedAt)}
              </div>
              {myShiftAktif.openingCash !== null && (
                <div className="text-xs text-emerald-700 mt-1">
                  Uang awal: {formatRupiah(myShiftAktif.openingCash)}
                </div>
              )}
            </div>
            <button
              onClick={() => setOpenTutup(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50"
              disabled={pending}
            >
              <Square size={14} /> Tutup Shift
            </button>
          </div>

          {ringkasanAktif && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-emerald-200">
              <Stat label="Transaksi" value={String(ringkasanAktif.jumlahTransaksi)} />
              <Stat label="Order lunas" value={String(ringkasanAktif.jumlahOrder)} />
              <Stat label="Omzet cash" value={formatRupiah(ringkasanAktif.omzetCash)} accent />
              <Stat label="Omzet transfer" value={formatRupiah(ringkasanAktif.omzetTransfer)} />
              <Stat label="Omzet QRIS" value={formatRupiah(ringkasanAktif.omzetQris)} />
              <Stat
                label="Pengeluaran"
                value={formatRupiah(ringkasanAktif.totalPengeluaran)}
                negative
              />
            </div>
          )}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="text-[10px] font-bold tracking-widest text-amber-800">
                BELUM ADA SHIFT AKTIF
              </div>
              <div className="text-sm font-bold text-amber-900 mt-1 inline-flex items-center gap-1.5">
                <AlertTriangle size={14} /> Buka shift dulu sebelum input transaksi POS
              </div>
            </div>
            <button
              onClick={() => setOpenBuka(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-extrabold inline-flex items-center gap-1.5"
            >
              <Play size={14} /> Buka Shift
            </button>
          </div>
        </div>
      )}

      {/* Shift kasir lain yang aktif (untuk take-over awareness) */}
      {semuaShiftAktif.length > 0 && (
        <section>
          <h2 className="text-xs font-bold tracking-widest text-[color:var(--muted)] mb-2 inline-flex items-center gap-1.5">
            <Users size={12} /> SHIFT KASIR LAIN AKTIF
          </h2>
          <div className="space-y-2">
            {semuaShiftAktif.map((s) => (
              <div
                key={s.id}
                className="bg-surface border border-line rounded-xl p-3 flex justify-between items-center"
              >
                <div>
                  <div className="font-bold text-sm">{s.kasirNama}</div>
                  <div className="text-[11px] text-[color:var(--muted)]">
                    Sejak {fmt(s.openedAt)}
                    {s.openingCash !== null && ` · Uang awal ${formatRupiah(s.openingCash)}`}
                  </div>
                </div>
                <div className="text-[10px] text-[color:var(--muted)]">
                  (kasir aktif lain di sistem)
                </div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-[color:var(--muted)] mt-2">
            ℹ Setiap kasir punya shift sendiri. Multiple shift bisa aktif bersamaan.
          </div>
        </section>
      )}

      {/* Riwayat shift saya hari ini */}
      {shiftHariIni.length > 0 && (
        <section>
          <h2 className="text-xs font-bold tracking-widest text-[color:var(--muted)] mb-2">
            SHIFT SAYA HARI INI
          </h2>
          <div className="space-y-2">
            {shiftHariIni.map((s) => (
              <div
                key={s.id}
                className={`bg-surface border rounded-xl p-3 ${s.status === "open" ? "border-emerald-200" : "border-line"}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-bold text-sm inline-flex items-center gap-1.5">
                      <Clock size={12} /> {fmt(s.openedAt)}
                      {s.closedAt && ` → ${fmt(s.closedAt)}`}
                    </div>
                    <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
                      Status:{" "}
                      <span
                        className={`font-bold ${s.status === "open" ? "text-emerald-700" : "text-[color:var(--muted)]"}`}
                      >
                        {s.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  {s.dapatReopen && (
                    <button
                      onClick={() => handleReopen(s.id)}
                      disabled={pending}
                      className="px-2 py-1 text-[11px] border border-amber-300 text-amber-700 rounded-md inline-flex items-center gap-1"
                      title="Buka kembali (hanya dalam 30 menit setelah tutup)"
                    >
                      <RefreshCw size={10} /> Reopen
                    </button>
                  )}
                </div>
                {s.status === "closed" && (
                  <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-line text-[11px]">
                    <div>
                      <div className="text-[color:var(--muted)]">Uang fisik</div>
                      <div className="font-bold">{formatRupiah(s.closingCashCounted ?? 0)}</div>
                    </div>
                    <div>
                      <div className="text-[color:var(--muted)]">Ekspektasi</div>
                      <div className="font-bold">{formatRupiah(s.closingCashExpected ?? 0)}</div>
                    </div>
                    <div>
                      <div className="text-[color:var(--muted)]">Selisih</div>
                      <div
                        className={`font-extrabold ${
                          (s.selisih ?? 0) === 0
                            ? "text-[color:var(--muted)]"
                            : (s.selisih ?? 0) > 0
                              ? "text-emerald-700"
                              : "text-red-600"
                        }`}
                      >
                        {(s.selisih ?? 0) > 0 ? "+" : ""}
                        {formatRupiah(s.selisih ?? 0)}
                      </div>
                    </div>
                  </div>
                )}
                {s.catatan && (
                  <div className="text-[11px] text-[color:var(--muted)] mt-2 italic">
                    "{s.catatan}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {openBuka && (
        <BukaModal
          onClose={() => setOpenBuka(false)}
          nextUrl={nextUrl ?? null}
        />
      )}
      {openTutup && myShiftAktif && ringkasanAktif && (
        <TutupModal
          shiftId={myShiftAktif.id}
          ringkasan={ringkasanAktif}
          onClose={() => setOpenTutup(false)}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  negative,
}: {
  label: string;
  value: string;
  accent?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="bg-white/60 rounded-lg p-2">
      <div className="text-[9px] uppercase tracking-widest text-[color:var(--muted)]">{label}</div>
      <div
        className={`font-extrabold text-sm ${accent ? "text-emerald-800" : negative ? "text-red-700" : "text-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}

function BukaModal({
  onClose,
  nextUrl,
}: {
  onClose: () => void;
  nextUrl: string | null;
}) {
  const [openingCash, setOpeningCash] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit() {
    setError(null);
    const cash = openingCash.trim() === "" ? null : Number(openingCash);
    if (cash !== null && (!Number.isFinite(cash) || cash < 0)) {
      setError("Jumlah harus angka >= 0 atau kosongkan untuk skip");
      return;
    }
    startTransition(async () => {
      const r = await bukaShiftAction(cash);
      if ("error" in r) setError(r.error);
      else {
        onClose();
        if (nextUrl) {
          router.push(nextUrl);
        } else {
          router.refresh();
        }
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4">
      <div className="bg-surface rounded-2xl max-w-md w-full p-5 space-y-4">
        <div className="flex justify-between items-start">
          <h2 className="font-bold text-lg inline-flex items-center gap-1.5">
            <Play size={18} className="text-emerald-600" /> Buka Shift
          </h2>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="text-sm text-[color:var(--muted)]">
          Catat berapa uang di laci awal shift (opsional). Sistem akan bandingkan dengan
          uang fisik saat tutup shift untuk hitung selisih.
        </div>
        {nextUrl && (
          <div className="bg-sky-50 border border-sky-200 rounded-md p-2 text-[11px] text-sky-800">
            ℹ Setelah buka shift, Anda akan otomatis dilanjutkan ke halaman sebelumnya.
          </div>
        )}
        <div>
          <label className="text-xs font-bold block mb-1">Uang Awal di Laci (Rp)</label>
          <input
            type="number"
            min={0}
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            placeholder="Kosongkan kalau tidak mau hitung"
            className="w-full px-3 py-2 border border-line rounded-md text-lg font-mono"
            autoFocus
          />
          <div className="text-[10px] text-[color:var(--muted)] mt-1">
            mis. Rp 500.000 untuk kembalian. Kosongkan = skip perbandingan selisih.
          </div>
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button onClick={onClose} className="px-4 py-2 border border-line rounded-md text-sm">
            Batal
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            Buka Shift
          </button>
        </div>
      </div>
    </div>
  );
}

function TutupModal({
  shiftId,
  ringkasan,
  onClose,
}: {
  shiftId: number;
  ringkasan: Ringkasan;
  onClose: () => void;
}) {
  const [counted, setCounted] = useState(String(ringkasan.expected));
  const [catatan, setCatatan] = useState("");
  const [buktiBase64, setBuktiBase64] = useState<string | null>(null);
  const [buktiMime, setBuktiMime] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const countedNum = Math.max(0, Math.floor(Number(counted) || 0));
  const selisih = countedNum - ringkasan.expected;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setBuktiBase64(base64);
      setBuktiMime(file.type);
    };
    reader.readAsDataURL(file);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await tutupShiftAction({
        shiftId,
        closingCashCounted: countedNum,
        catatan,
        buktiBase64,
        buktiMimeType: buktiMime,
      });
      if ("error" in r) setError(r.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4 overflow-auto">
      <div className="bg-surface rounded-2xl max-w-md w-full p-5 space-y-3 my-4">
        <div className="flex justify-between items-start">
          <h2 className="font-bold text-lg inline-flex items-center gap-1.5">
            <Square size={18} className="text-red-600" /> Tutup Shift
          </h2>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="bg-[color:var(--surface2)] rounded-xl p-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-[color:var(--muted)]">Uang awal</span>
            <b>{formatRupiah(ringkasan.openingCash)}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-[color:var(--muted)]">
              + Omzet cash ({ringkasan.jumlahTransaksi}x)
            </span>
            <b className="text-emerald-700">{formatRupiah(ringkasan.omzetCash)}</b>
          </div>
          <div className="text-[10px] text-[color:var(--muted)] pl-3 italic">
            includes POS langsung + pelunasan piutang cash
          </div>
          <div className="flex justify-between">
            <span className="text-[color:var(--muted)]">− Pengeluaran ({ringkasan.jumlahPengeluaran}x)</span>
            <b className="text-red-600">{formatRupiah(ringkasan.totalPengeluaran)}</b>
          </div>
          <div className="border-t border-line my-1" />
          <div className="flex justify-between font-bold">
            <span>= Ekspektasi cash</span>
            <span>{formatRupiah(ringkasan.expected)}</span>
          </div>
          {(ringkasan.omzetTransfer > 0 || ringkasan.omzetQris > 0) && (
            <div className="border-t border-line my-1 pt-2 text-[10px] text-[color:var(--muted)]">
              <div className="font-bold mb-0.5">Non-cash (langsung ke rekening, TIDAK masuk laci):</div>
              {ringkasan.omzetTransfer > 0 && (
                <div className="flex justify-between">
                  <span>Transfer</span>
                  <span>{formatRupiah(ringkasan.omzetTransfer)}</span>
                </div>
              )}
              {ringkasan.omzetQris > 0 && (
                <div className="flex justify-between">
                  <span>QRIS</span>
                  <span>{formatRupiah(ringkasan.omzetQris)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-bold block mb-1 inline-flex items-center gap-1">
            <Coins size={12} /> Uang Fisik di Laci (hitung manual)
          </label>
          <input
            type="number"
            min={0}
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-lg font-mono font-bold"
            autoFocus
          />
        </div>

        <div
          className={`rounded-xl p-3 text-sm font-bold ${
            selisih === 0
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : selisih > 0
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {selisih === 0 ? (
            <>✓ Pas, tidak ada selisih</>
          ) : selisih > 0 ? (
            <>🟢 LEBIH {formatRupiah(selisih)} dari ekspektasi</>
          ) : (
            <>🔴 KURANG {formatRupiah(Math.abs(selisih))} dari ekspektasi</>
          )}
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">Catatan (opsional)</label>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            rows={2}
            placeholder="mis: ada koin Rp 500 saya ganti pakai uang sendiri"
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">Foto Bukti Uang (opsional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="w-full text-xs"
          />
          {buktiBase64 && (
            <div className="text-[10px] text-emerald-700 mt-1">✓ Foto siap diupload</div>
          )}
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}

        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button onClick={onClose} className="px-4 py-2 border border-line rounded-md text-sm">
            Batal
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            Konfirmasi Tutup Shift
          </button>
        </div>
      </div>
    </div>
  );
}
