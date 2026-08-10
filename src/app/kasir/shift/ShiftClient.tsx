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
  Plus,
  Trash2,
} from "lucide-react";
import {
  bukaShiftAction,
  tutupShiftAction,
  reopenShiftAction,
  editOpeningCashAction,
} from "./actions";
import {
  tambahKasMasukAction,
  hapusKasMasukAction,
} from "./kas-masuk-actions";
import {
  tambahPengeluaranKasirAction,
  hapusPengeluaranKasirAction,
} from "./pengeluaran-actions";
import { formatRupiah } from "@/lib/utils";
import { RupiahInput } from "@/components/RupiahInput";

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
  totalKasMasukLain: number;
  jumlahKasMasukLain: number;
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

type KasMasukItem = {
  id: number;
  tanggal: string;
  kategori: string;
  jumlah: number;
  deskripsi: string | null;
};

type PengeluaranItem = {
  id: number;
  tanggal: string;
  kategori: string;
  jumlah: number;
  deskripsi: string | null;
  fotoNotaUrl: string | null;
};

const KATEGORI_LABEL: Record<string, string> = {
  "pelunasan-offline": "Pelunasan piutang offline",
  tip: "Tip pelanggan",
  "setoran-titip": "Setoran titip kasir",
  "kembalian-tidak-diambil": "Kembalian tidak diambil",
  lainnya: "Lainnya",
};

type PendingHandover = {
  fromShiftId: number;
  amount: number;
  fromKasirNama: string;
  closedAt: string | null;
  catatan: string | null;
  fotoUrl: string | null;
} | null;

type KasirOption = { id: string; name: string };

export function ShiftClient({
  myShiftAktif,
  ringkasanAktif,
  semuaShiftAktif,
  shiftHariIni,
  nextUrl,
  autoOpenTutup,
  kasMasukList,
  pengeluaranList,
  pendingHandover,
  kasirLain,
  kategoriPengeluaranMaster,
}: {
  myShiftAktif: MyShiftAktif | null;
  ringkasanAktif: Ringkasan | null;
  semuaShiftAktif: ShiftAktif[];
  shiftHariIni: ShiftHariIni[];
  nextUrl?: string | null;
  autoOpenTutup?: boolean;
  kasMasukList: KasMasukItem[];
  pengeluaranList: PengeluaranItem[];
  pendingHandover: PendingHandover;
  kasirLain: KasirOption[];
  kategoriPengeluaranMaster: { id: number; slug: string; nama: string }[];
}) {
  // Auto-open modal buka shift kalau ada nextUrl dan belum ada shift aktif
  const [openBuka, setOpenBuka] = useState(Boolean(nextUrl && !myShiftAktif));
  // Modal tutup shift TIDAK auto-open lagi — kasir manual klik tombol Tutup.
  // (Auto-open dulu memaksa kasir tutup, padahal shift malam masih wajar.)
  void autoOpenTutup;
  const [openTutup, setOpenTutup] = useState(false);
  const [openEditUangAwal, setOpenEditUangAwal] = useState(false);
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
              <div className="text-xs text-emerald-700 mt-1 inline-flex items-center gap-2">
                Uang awal:{" "}
                <b>
                  {myShiftAktif.openingCash !== null
                    ? formatRupiah(myShiftAktif.openingCash)
                    : "—"}
                </b>
                <button
                  onClick={() => setOpenEditUangAwal(true)}
                  className="text-[10px] text-amber-700 hover:underline font-bold"
                  title="Koreksi uang awal kalau typo / salah hitung"
                >
                  ✎ Edit
                </button>
              </div>
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

      {/* Kas masuk lain-lain (di luar omzet POS) */}
      {myShiftAktif && (
        <KasMasukSection
          shiftId={myShiftAktif.id}
          items={kasMasukList}
        />
      )}

      {/* Pengeluaran shift (bensin, ongkos kurir, dll) */}
      {myShiftAktif && (
        <PengeluaranSection
          shiftId={myShiftAktif.id}
          items={pengeluaranList}
          kategoriMaster={kategoriPengeluaranMaster}
        />
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
          pendingHandover={pendingHandover}
        />
      )}
      {openTutup && myShiftAktif && ringkasanAktif && (
        <TutupModal
          shiftId={myShiftAktif.id}
          ringkasan={ringkasanAktif}
          onClose={() => setOpenTutup(false)}
          kasirLain={kasirLain}
        />
      )}
      {openEditUangAwal && myShiftAktif && (
        <EditUangAwalModal
          shiftId={myShiftAktif.id}
          currentOpeningCash={myShiftAktif.openingCash}
          onClose={() => setOpenEditUangAwal(false)}
        />
      )}
    </div>
  );
}

function EditUangAwalModal({
  shiftId,
  currentOpeningCash,
  onClose,
}: {
  shiftId: number;
  currentOpeningCash: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [nilai, setNilai] = useState(currentOpeningCash !== null ? String(currentOpeningCash) : "");
  const [alasan, setAlasan] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const n = Number(nilai);
    if (!Number.isFinite(n) || n < 0) {
      setError("Uang awal harus angka >= 0");
      return;
    }
    if (alasan.trim().length < 3) {
      setError("Alasan wajib (min 3 karakter)");
      return;
    }
    startTransition(async () => {
      const r = await editOpeningCashAction({
        shiftId,
        newOpeningCash: Math.floor(n),
        alasan,
      });
      if ("error" in r) setError(r.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4">
      <div className="bg-surface rounded-2xl max-w-md w-full p-5 space-y-3">
        <div className="flex justify-between items-start">
          <h2 className="font-bold text-lg">Edit Uang Awal</h2>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="text-xs text-[color:var(--muted)]">
          Koreksi uang awal kalau typo / salah hitung. Perubahan ditrack di audit log.
        </div>
        <div className="text-xs bg-[color:var(--surface2)] rounded p-2">
          Saat ini: <b>{currentOpeningCash !== null ? `Rp ${currentOpeningCash.toLocaleString("id-ID")}` : "—"}</b>
        </div>
        <div>
          <label className="text-xs font-bold block mb-1">Uang Awal Baru (Rp)</label>
          <RupiahInput
            value={nilai}
            onChange={setNilai}
            autoFocus
            className="w-full px-3 py-2 border border-line rounded-md text-lg font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-bold block mb-1">Alasan (wajib)</label>
          <textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            rows={2}
            placeholder="mis: typo 115 harusnya 115000"
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
          />
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button onClick={onClose} disabled={pending} className="px-4 py-2 border border-line rounded-md text-sm">
            Batal
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
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
  pendingHandover,
}: {
  onClose: () => void;
  nextUrl: string | null;
  pendingHandover: PendingHandover;
}) {
  const initOpening = pendingHandover ? String(pendingHandover.amount) : "";
  const [openingCash, setOpeningCash] = useState(initOpening);
  const [extraSource, setExtraSource] = useState("setoran-owner");
  const [extraCatatan, setExtraCatatan] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const openingNum = openingCash.trim() === "" ? null : Number(openingCash);
  const handoverAmt = pendingHandover?.amount ?? 0;
  const diff = openingNum !== null ? openingNum - handoverAmt : 0;
  const needsExplanation = pendingHandover !== null && diff !== 0;
  const isExtraPositive = diff > 0;

  function submit() {
    setError(null);
    const cash = openingNum;
    if (cash !== null && (!Number.isFinite(cash) || cash < 0)) {
      setError("Jumlah harus angka >= 0 atau kosongkan untuk skip");
      return;
    }
    if (needsExplanation) {
      if (!extraSource) {
        setError("Pilih kategori sumber uang tambahan");
        return;
      }
      if (extraCatatan.trim().length < 3) {
        setError("Catatan wajib (min 3 karakter)");
        return;
      }
    }
    startTransition(async () => {
      const r = await bukaShiftAction({
        openingCash: cash,
        openingFromShiftId: pendingHandover?.fromShiftId ?? null,
        openingExtraAmount: needsExplanation && isExtraPositive ? diff : 0,
        openingExtraSource: needsExplanation && isExtraPositive ? extraSource : null,
        openingExtraCatatan: needsExplanation ? extraCatatan.trim() : null,
      });
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
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4 overflow-auto">
      <div className="bg-surface rounded-2xl max-w-md w-full p-5 space-y-3 my-4">
        <div className="flex justify-between items-start">
          <h2 className="font-bold text-lg inline-flex items-center gap-1.5">
            <Play size={18} className="text-emerald-600" /> Buka Shift
          </h2>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {pendingHandover && (
          <div className="bg-brand-soft border-2 border-brand/30 rounded-lg p-3 space-y-1">
            <div className="text-xs font-extrabold text-brand inline-flex items-center gap-1.5">
              📥 Handover dari {pendingHandover.fromKasirNama}
            </div>
            <div className="text-sm">
              Uang diserahkan:{" "}
              <b className="text-emerald-700">{formatRupiah(pendingHandover.amount)}</b>
            </div>
            {pendingHandover.catatan && (
              <div className="text-[11px] text-[color:var(--muted)] italic">
                &quot;{pendingHandover.catatan}&quot;
              </div>
            )}
            {pendingHandover.fotoUrl && (
              <a
                href={pendingHandover.fotoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-brand hover:underline inline-flex items-center gap-1"
              >
                📷 Lihat foto bukti
              </a>
            )}
          </div>
        )}

        <div className="text-xs text-[color:var(--muted)]">
          {pendingHandover
            ? "Opening auto-suggest = uang handover. Kalau berbeda (mis. dapat tambahan dari owner), wajib jelaskan sumbernya."
            : "Catat berapa uang di laci awal shift (opsional)."}
        </div>

        {nextUrl && (
          <div className="bg-sky-50 border border-sky-200 rounded-md p-2 text-[11px] text-sky-800">
            ℹ Setelah buka shift, Anda akan otomatis dilanjutkan ke halaman sebelumnya.
          </div>
        )}

        <div>
          <label className="text-xs font-bold block mb-1">Uang Awal di Laci (Rp)</label>
          <RupiahInput
            value={openingCash}
            onChange={setOpeningCash}
            placeholder="Kosongkan kalau tidak mau hitung"
            autoFocus
            className="w-full px-3 py-2 border border-line rounded-md text-lg font-mono"
          />
          <div className="text-[10px] text-[color:var(--muted)] mt-1">
            mis. Rp 500.000 untuk kembalian. Kosongkan = skip perbandingan selisih.
          </div>
        </div>

        {needsExplanation && (
          <div
            className={`rounded-lg p-3 space-y-2 border-2 ${
              isExtraPositive
                ? "bg-amber-50 border-amber-300"
                : "bg-red-50 border-red-300"
            }`}
          >
            <div className="text-xs font-extrabold inline-flex items-center gap-1.5">
              <AlertTriangle size={14} />
              Opening {isExtraPositive ? "+" : ""}
              {formatRupiah(diff)} dari handover — WAJIB jelaskan
            </div>
            {isExtraPositive ? (
              <>
                <div>
                  <label className="text-[11px] font-bold block mb-1">
                    Sumber uang tambahan
                  </label>
                  <select
                    value={extraSource}
                    onChange={(e) => setExtraSource(e.target.value)}
                    className="w-full px-2 py-1.5 border border-line rounded text-sm bg-surface"
                  >
                    <option value="setoran-owner">Setoran modal dari owner</option>
                    <option value="sisa-cash">Sisa cash dari kemarin</option>
                    <option value="kas-masuk-lain">Kas masuk lain (pelunasan offline dll)</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold block mb-1">
                    Catatan (min 3 karakter)
                  </label>
                  <input
                    type="text"
                    value={extraCatatan}
                    onChange={(e) => setExtraCatatan(e.target.value)}
                    placeholder="mis: Owner kasih tambahan modal Rp 117rb pagi ini"
                    className="w-full px-2 py-1.5 border border-line rounded text-sm"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="text-[11px] font-bold block mb-1">
                  Alasan kenapa opening lebih kecil dari handover
                </label>
                <input
                  type="text"
                  value={extraCatatan}
                  onChange={(e) => setExtraCatatan(e.target.value)}
                  placeholder="mis: Rp X dibayar pengeluaran / diambil owner sebelum shift"
                  className="w-full px-2 py-1.5 border border-line rounded text-sm"
                />
              </div>
            )}
          </div>
        )}

        {error && <div className="text-xs text-red-600 font-bold">{error}</div>}

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
  kasirLain,
}: {
  shiftId: number;
  ringkasan: Ringkasan;
  onClose: () => void;
  kasirLain: KasirOption[];
}) {
  const [counted, setCounted] = useState(String(ringkasan.expected));
  const [catatan, setCatatan] = useState("");
  // Handover state
  const [handoverEnabled, setHandoverEnabled] = useState(false);
  const [handoverAmount, setHandoverAmount] = useState("");
  const [handoverToKasirId, setHandoverToKasirId] = useState("");
  const [handoverBase64, setHandoverBase64] = useState<string | null>(null);
  const [handoverMime, setHandoverMime] = useState<string | null>(null);
  const [handoverCatatan, setHandoverCatatan] = useState("");
  const [buktiBase64, setBuktiBase64] = useState<string | null>(null);
  const [buktiMime, setBuktiMime] = useState<string | null>(null);
  const [selisihKategori, setSelisihKategori] = useState("");
  const [selisihAlasan, setSelisihAlasan] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const countedNum = Math.max(0, Math.floor(Number(counted) || 0));
  const selisih = countedNum - ringkasan.expected;
  const hasSelisih = selisih !== 0;

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

  const handoverAmountNum = handoverEnabled
    ? Math.max(0, Math.floor(Number(handoverAmount) || 0))
    : 0;

  async function handleHandoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const b64 = dataUrl.split(",")[1];
      setHandoverBase64(b64);
      setHandoverMime(file.type);
    };
    reader.readAsDataURL(file);
  }

  function submit() {
    setError(null);
    if (hasSelisih) {
      if (!selisihKategori) {
        setError("Selisih terdeteksi — pilih kategori penyebabnya");
        return;
      }
      if (selisihAlasan.trim().length < 3) {
        setError("Selisih terdeteksi — alasan wajib (min 3 karakter)");
        return;
      }
    }
    if (handoverEnabled) {
      if (handoverAmountNum <= 0) {
        setError("Jumlah handover harus > 0 (atau matikan toggle handover)");
        return;
      }
      if (handoverAmountNum > countedNum) {
        setError(
          `Handover tidak boleh > uang fisik (${formatRupiah(countedNum)})`,
        );
        return;
      }
      if (!handoverToKasirId) {
        setError("Pilih kasir yang menerima uang handover");
        return;
      }
    }
    startTransition(async () => {
      const r = await tutupShiftAction({
        shiftId,
        closingCashCounted: countedNum,
        catatan,
        buktiBase64,
        buktiMimeType: buktiMime,
        selisihKategori: hasSelisih ? selisihKategori : null,
        selisihAlasan: hasSelisih ? selisihAlasan.trim() : null,
        handoverAmount: handoverEnabled ? handoverAmountNum : 0,
        handoverToKasirUserId: handoverEnabled ? handoverToKasirId : null,
        handoverBase64: handoverEnabled ? handoverBase64 : null,
        handoverMimeType: handoverEnabled ? handoverMime : null,
        handoverCatatan: handoverEnabled ? handoverCatatan.trim() || null : null,
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
          {ringkasan.totalKasMasukLain > 0 && (
            <div className="flex justify-between">
              <span className="text-[color:var(--muted)]">
                + Kas masuk lain ({ringkasan.jumlahKasMasukLain}x)
              </span>
              <b className="text-emerald-700">
                {formatRupiah(ringkasan.totalKasMasukLain)}
              </b>
            </div>
          )}
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
          <RupiahInput
            value={counted}
            onChange={setCounted}
            autoFocus
            className="w-full px-3 py-2 border border-line rounded-md text-lg font-mono font-bold"
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

        {hasSelisih && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 space-y-2">
            <div className="text-xs font-extrabold text-amber-900 inline-flex items-center gap-1.5">
              <AlertTriangle size={14} /> WAJIB: Jelaskan sumber selisih
            </div>
            <div>
              <label className="text-[11px] font-bold text-amber-900 block mb-1">
                Kategori penyebab
              </label>
              <select
                value={selisihKategori}
                onChange={(e) => setSelisihKategori(e.target.value)}
                className="w-full px-3 py-2 border border-amber-300 rounded-md text-sm bg-surface"
              >
                <option value="">— Pilih kategori —</option>
                <option value="pengeluaran-lupa-input">
                  Pengeluaran lupa diinput
                </option>
                <option value="setoran-owner">Setoran modal owner</option>
                <option value="pelunasan-offline">
                  Pelunasan piutang langsung (tidak via app)
                </option>
                <option value="bayar-lebih">Pelanggan bayar lebih</option>
                <option value="kembalian-tidak-diambil">
                  Kembalian tidak diambil
                </option>
                <option value="tip">Tip pelanggan</option>
                <option value="kurang-bayar">Pelanggan kurang bayar</option>
                <option value="hilang">Hilang / tidak tahu</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-amber-900 block mb-1">
                Penjelasan detail (min 3 karakter)
              </label>
              <textarea
                value={selisihAlasan}
                onChange={(e) => setSelisihAlasan(e.target.value)}
                rows={2}
                placeholder="mis: bayar antar barang Rp 50rb tapi lupa input pengeluaran"
                className="w-full px-3 py-2 border border-amber-300 rounded-md text-sm"
              />
            </div>
          </div>
        )}

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

        {/* Handover section */}
        <div className="bg-brand-soft border border-brand/20 rounded-lg p-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={handoverEnabled}
              onChange={(e) => setHandoverEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-xs font-extrabold text-brand inline-flex items-center gap-1.5">
              📥 Serah-terima uang ke kasir berikutnya
            </span>
          </label>
          <div className="text-[10px] text-[color:var(--muted)]">
            Aktifkan kalau Anda menyerahkan uang laci ke kasir berikutnya.
            Kasir penerima akan lihat info handover saat buka shift baru.
          </div>

          {handoverEnabled && (
            <div className="space-y-2 pt-2 border-t border-brand/20">
              <div>
                <label className="text-[11px] font-bold block mb-1">
                  Diserahkan kepada
                </label>
                <select
                  value={handoverToKasirId}
                  onChange={(e) => setHandoverToKasirId(e.target.value)}
                  className="w-full px-2 py-1.5 border border-line rounded text-sm bg-surface"
                >
                  <option value="">— Pilih kasir —</option>
                  {kasirLain.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1">
                  Jumlah diserahkan (Rp) — auto-fill uang fisik
                </label>
                <RupiahInput
                  value={handoverAmount || String(countedNum)}
                  onChange={setHandoverAmount}
                  className="w-full px-2 py-1.5 border border-line rounded text-sm font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1">
                  Foto bukti serah-terima (opsional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleHandoverFile}
                  className="w-full text-xs"
                />
                {handoverBase64 && (
                  <div className="text-[10px] text-emerald-700 mt-1">
                    ✓ Foto handover siap upload
                  </div>
                )}
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1">
                  Catatan (opsional)
                </label>
                <input
                  type="text"
                  value={handoverCatatan}
                  onChange={(e) => setHandoverCatatan(e.target.value)}
                  placeholder="mis: Uang tunai Rp 65rb, kembalian Rp 100rb, dst"
                  className="w-full px-2 py-1.5 border border-line rounded text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {error && <div className="text-xs text-red-600 font-bold">{error}</div>}

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

function KasMasukSection({
  shiftId,
  items,
}: {
  shiftId: number;
  items: KasMasukItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [jumlah, setJumlah] = useState("");
  const [kategori, setKategori] = useState("pelunasan-offline");
  const [deskripsi, setDeskripsi] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const total = items.reduce((s, it) => s + it.jumlah, 0);

  function handleSubmit() {
    setErr(null);
    const j = parseInt(jumlah.replace(/\D/g, ""), 10);
    if (!Number.isFinite(j) || j <= 0) {
      setErr("Jumlah harus > 0");
      return;
    }
    if (deskripsi.trim().length < 3) {
      setErr("Keterangan wajib (min 3 karakter)");
      return;
    }
    startTransition(async () => {
      const res = await tambahKasMasukAction({
        jumlah: j,
        kategori,
        deskripsi: deskripsi.trim(),
        shiftId,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setJumlah("");
      setDeskripsi("");
      setKategori("pelunasan-offline");
      setShowForm(false);
      router.refresh();
    });
  }

  function handleHapus(id: number, label: string) {
    const alasan = prompt(
      `HAPUS kas masuk "${label}"?\n\nAlasan (min 3 karakter):`,
    );
    if (!alasan || alasan.trim().length < 3) return;
    startTransition(async () => {
      const res = await hapusKasMasukAction(id, alasan.trim());
      if ("error" in res) {
        alert(`Gagal: ${res.error}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-bold tracking-widest text-[color:var(--muted)] inline-flex items-center gap-1.5">
          <Coins size={12} /> KAS MASUK LAIN-LAIN
          {total > 0 && (
            <span className="text-emerald-700">· {formatRupiah(total)}</span>
          )}
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 hover:bg-emerald-700"
          >
            <Plus size={12} /> Tambah
          </button>
        )}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-900 leading-snug mb-2">
        Pakai untuk uang yang masuk laci tapi <b>tidak dari transaksi POS</b>:
        pelanggan bayar piutang langsung (tanpa app), tip, kembalian tidak
        diambil, dst.
      </div>

      {showForm && (
        <div className="bg-surface border-2 border-emerald-300 rounded-xl p-3 mb-2 space-y-2">
          <div>
            <label className="text-[11px] font-bold text-[color:var(--muted)]">
              Jumlah (Rp)
            </label>
            <RupiahInput
              value={jumlah}
              onChange={setJumlah}
              placeholder="10000"
              autoFocus
              className="w-full mt-1 px-3 py-2 border border-line rounded-lg text-sm font-bold"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[color:var(--muted)]">
              Kategori
            </label>
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-line rounded-lg text-sm bg-surface"
            >
              {Object.entries(KATEGORI_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-[color:var(--muted)]">
              Keterangan (min 3 karakter)
            </label>
            <input
              type="text"
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Ibu Ani bayar piutang langsung, tidak lewat app"
              className="w-full mt-1 px-3 py-2 border border-line rounded-lg text-sm"
            />
          </div>
          {err && (
            <div className="text-xs text-red-600 font-bold">{err}</div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={pending}
              className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {pending ? "Menyimpan…" : "Simpan"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setErr(null);
              }}
              disabled={pending}
              className="px-3 py-2 border border-line rounded-lg text-sm font-bold"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-xs text-[color:var(--muted)] italic px-1">
          Belum ada kas masuk lain di shift ini.
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <div
              key={it.id}
              className="bg-surface border border-line rounded-lg px-3 py-2 flex justify-between items-start gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold inline-flex items-center gap-2">
                  {formatRupiah(it.jumlah)}
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    {KATEGORI_LABEL[it.kategori] ?? it.kategori}
                  </span>
                </div>
                {it.deskripsi && (
                  <div className="text-xs text-[color:var(--muted)] truncate">
                    {it.deskripsi}
                  </div>
                )}
                <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
                  {new Date(it.tanggal).toLocaleString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <button
                onClick={() =>
                  handleHapus(
                    it.id,
                    `${formatRupiah(it.jumlah)} - ${it.deskripsi ?? it.kategori}`,
                  )
                }
                disabled={pending}
                className="text-red-600 hover:bg-red-50 p-1.5 rounded disabled:opacity-50"
                title="Hapus"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PengeluaranSection({
  shiftId,
  items,
  kategoriMaster,
}: {
  shiftId: number;
  items: PengeluaranItem[];
  kategoriMaster: { id: number; slug: string; nama: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [jumlah, setJumlah] = useState("");
  const defaultKategoriId = kategoriMaster[0]?.id ?? 0;
  const [kategoriBiayaId, setKategoriBiayaId] = useState(defaultKategoriId);
  const [deskripsi, setDeskripsi] = useState("");
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [fotoMime, setFotoMime] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const total = items.reduce((s, it) => s + it.jumlah, 0);

  // Lookup slug → nama dari master (untuk display item existing).
  // Fallback: format slug jadi Title Case kalau tidak ada di master.
  const slugToNama = new Map(kategoriMaster.map((k) => [k.slug, k.nama]));
  function displayKategori(slug: string): string {
    return (
      slugToNama.get(slug) ??
      slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFotoBase64(null);
      setFotoMime(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const b64 = result.split(",")[1] ?? "";
      setFotoBase64(b64);
      setFotoMime(file.type);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    setErr(null);
    const j = parseInt(jumlah.replace(/\D/g, ""), 10);
    if (!Number.isFinite(j) || j <= 0) {
      setErr("Jumlah harus > 0");
      return;
    }
    if (deskripsi.trim().length < 3) {
      setErr("Keterangan wajib (min 3 karakter)");
      return;
    }
    if (!kategoriBiayaId) {
      setErr("Kategori wajib dipilih");
      return;
    }
    startTransition(async () => {
      const res = await tambahPengeluaranKasirAction({
        jumlah: j,
        kategoriBiayaId,
        deskripsi: deskripsi.trim(),
        shiftId,
        fotoBase64,
        fotoMimeType: fotoMime,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setJumlah("");
      setDeskripsi("");
      setKategoriBiayaId(defaultKategoriId);
      setFotoBase64(null);
      setFotoMime(null);
      setShowForm(false);
      router.refresh();
    });
  }

  function handleHapus(id: number, label: string) {
    const alasan = prompt(
      `HAPUS pengeluaran "${label}"?\n\nAlasan (min 3 karakter):`,
    );
    if (!alasan || alasan.trim().length < 3) return;
    startTransition(async () => {
      const res = await hapusPengeluaranKasirAction(id, alasan.trim());
      if ("error" in res) {
        alert(`Gagal: ${res.error}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-bold tracking-widest text-[color:var(--muted)] inline-flex items-center gap-1.5">
          <Coins size={12} /> PENGELUARAN SHIFT
          {total > 0 && (
            <span className="text-red-700">· −{formatRupiah(total)}</span>
          )}
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 hover:bg-red-700"
          >
            <Plus size={12} /> Tambah
          </button>
        )}
      </div>
      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[11px] text-red-900 leading-snug mb-2">
        Pakai untuk uang yang <b>keluar dari laci</b> saat shift: bensin motor
        antar, tip kurir, beli galon eceran cepat, dst. Jangan cuma tulis di
        catatan — kalau tidak dicatat di sini, ekspektasi kas jadi salah.
      </div>

      {showForm && (
        <div className="bg-surface border-2 border-red-300 rounded-xl p-3 mb-2 space-y-2">
          <div>
            <label className="text-[11px] font-bold text-[color:var(--muted)]">
              Jumlah (Rp)
            </label>
            <RupiahInput
              value={jumlah}
              onChange={setJumlah}
              placeholder="20000"
              autoFocus
              className="w-full mt-1 px-3 py-2 border border-line rounded-lg text-sm font-bold"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[color:var(--muted)]">
              Kategori
            </label>
            <select
              value={kategoriBiayaId}
              onChange={(e) => setKategoriBiayaId(Number(e.target.value))}
              className="w-full mt-1 px-3 py-2 border border-line rounded-lg text-sm bg-surface"
            >
              {kategoriMaster.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-[color:var(--muted)]">
              Keterangan (min 3 karakter)
            </label>
            <input
              type="text"
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Bensin motor antar 3 jerigen"
              className="w-full mt-1 px-3 py-2 border border-line rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[color:var(--muted)]">
              Foto nota (opsional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="w-full mt-1 text-xs"
            />
            {fotoBase64 && (
              <div className="text-[10px] text-emerald-700 mt-1">
                ✓ Foto siap upload
              </div>
            )}
          </div>
          {err && (
            <div className="text-xs text-red-600 font-bold">{err}</div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={pending}
              className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {pending ? "Menyimpan…" : "Simpan"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setErr(null);
                setFotoBase64(null);
                setFotoMime(null);
              }}
              disabled={pending}
              className="px-3 py-2 border border-line rounded-lg text-sm font-bold"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-xs text-[color:var(--muted)] italic px-1">
          Belum ada pengeluaran di shift ini.
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <div
              key={it.id}
              className="bg-surface border border-line rounded-lg px-3 py-2 flex justify-between items-start gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold inline-flex items-center gap-2">
                  −{formatRupiah(it.jumlah)}
                  <span className="text-[10px] font-medium text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                    {displayKategori(it.kategori)}
                  </span>
                </div>
                {it.deskripsi && (
                  <div className="text-xs text-[color:var(--muted)] truncate">
                    {it.deskripsi}
                  </div>
                )}
                <div className="text-[10px] text-[color:var(--muted)] mt-0.5 inline-flex items-center gap-2">
                  {new Date(it.tanggal).toLocaleString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {it.fotoNotaUrl && (
                    <a
                      href={it.fotoNotaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Nota
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() =>
                  handleHapus(
                    it.id,
                    `${formatRupiah(it.jumlah)} - ${it.deskripsi ?? it.kategori}`,
                  )
                }
                disabled={pending}
                className="text-red-600 hover:bg-red-50 p-1.5 rounded disabled:opacity-50"
                title="Hapus"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
