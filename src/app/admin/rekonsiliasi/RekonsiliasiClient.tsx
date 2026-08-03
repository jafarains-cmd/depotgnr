"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, AlertTriangle, Trash2, Edit3, ChevronDown } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { verifikasiHarianAction, hapusVerifikasiAction } from "./actions";

type Rekon = {
  id: number;
  saldoAktual: number;
  selisih: number;
  catatan: string | null;
  buktiFotoUrl: string | null;
  verifiedAt: string;
  verifiedByName: string | null;
} | null;

type DetailTx = {
  id: number;
  jenis: "pos" | "order";
  nomor: string;
  pelangganNama: string | null;
  petugasNama: string | null;
  shiftKasirNama: string | null;
  jam: string;
  total: number;
};

type MetodeBucket = {
  omzetSistem: number;
  rekon: Rekon;
  detail: DetailTx[];
};

type HariItem = {
  tanggal: string; // YYYY-MM-DD
  transfer: MetodeBucket;
  qris: MetodeBucket;
};

export function RekonsiliasiClient({ hariList }: { hariList: HariItem[] }) {
  if (hariList.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-8 text-center text-sm text-[color:var(--muted)]">
        Belum ada aktivitas transfer / QRIS di rentang ini.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hariList.map((h) => (
        <HariCard key={h.tanggal} item={h} />
      ))}
    </div>
  );
}

function HariCard({ item }: { item: HariItem }) {
  const tglLabel = new Date(item.tanggal + "T00:00:00").toLocaleDateString(
    "id-ID",
    { weekday: "long", day: "2-digit", month: "short", year: "numeric" },
  );

  return (
    <div className="bg-surface border border-line rounded-2xl overflow-hidden">
      <div className="px-4 py-2 bg-[color:var(--surface2)] border-b border-line">
        <div className="text-sm font-bold">{tglLabel}</div>
      </div>
      <div className="divide-y divide-line">
        <MetodeRow
          tanggal={item.tanggal}
          metode="transfer"
          omzetSistem={item.transfer.omzetSistem}
          rekon={item.transfer.rekon}
          detail={item.transfer.detail}
        />
        <MetodeRow
          tanggal={item.tanggal}
          metode="qris"
          omzetSistem={item.qris.omzetSistem}
          rekon={item.qris.rekon}
          detail={item.qris.detail}
        />
      </div>
    </div>
  );
}

function MetodeRow({
  tanggal,
  metode,
  omzetSistem,
  rekon,
  detail,
}: {
  tanggal: string;
  metode: "transfer" | "qris";
  omzetSistem: number;
  rekon: Rekon;
  detail: DetailTx[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editMode, setEditMode] = useState(false);
  const [saldo, setSaldo] = useState(String(rekon?.saldoAktual ?? omzetSistem));
  const [catatan, setCatatan] = useState(rekon?.catatan ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [fotoMime, setFotoMime] = useState<string | null>(null);
  const [fotoNama, setFotoNama] = useState<string | null>(null);
  const [hapusBukti, setHapusBukti] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFotoBase64(null);
      setFotoMime(null);
      setFotoNama(null);
      return;
    }
    setFotoNama(file.name);
    setHapusBukti(false);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const b64 = result.split(",")[1] ?? "";
      setFotoBase64(b64);
      setFotoMime(file.type);
    };
    reader.readAsDataURL(file);
  }

  const label = metode === "transfer" ? "Transfer Bank" : "QRIS";
  const badgeColor =
    metode === "transfer" ? "bg-blue-100 text-blue-800" : "bg-violet-100 text-violet-800";

  // Kalau tidak ada omzet sistem & belum ada rekon → skip render (nothing to verify)
  if (omzetSistem === 0 && !rekon) {
    return (
      <div className="px-4 py-2 flex items-center gap-2 text-[11px] text-[color:var(--muted)] italic">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${badgeColor}`}>
          {label}
        </span>
        <span>Tidak ada transaksi {label.toLowerCase()} di hari ini</span>
      </div>
    );
  }

  const currentSaldo = parseInt(saldo.replace(/\D/g, ""), 10) || 0;
  const currentSelisih = currentSaldo - omzetSistem;

  function handleSubmit() {
    setErr(null);
    if (!Number.isFinite(currentSaldo) || currentSaldo < 0) {
      setErr("Saldo aktual harus >= 0");
      return;
    }
    if (currentSelisih !== 0 && catatan.trim().length < 3) {
      setErr(
        `Selisih ${currentSelisih > 0 ? "+" : ""}${formatRupiah(currentSelisih)} — catatan wajib (min 3 karakter)`,
      );
      return;
    }
    startTransition(async () => {
      const res = await verifikasiHarianAction({
        tanggalIso: tanggal,
        metode,
        saldoAktual: currentSaldo,
        catatan: catatan.trim(),
        fotoBase64,
        fotoMimeType: fotoMime,
        hapusBuktiFoto: hapusBukti,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setEditMode(false);
      setFotoBase64(null);
      setFotoMime(null);
      setFotoNama(null);
      setHapusBukti(false);
      router.refresh();
    });
  }

  function handleHapus() {
    if (!rekon) return;
    const alasan = prompt(
      `Hapus verifikasi ${label} ${tanggal}?\n\nAlasan (min 3 karakter):`,
    );
    if (!alasan || alasan.trim().length < 3) return;
    startTransition(async () => {
      const res = await hapusVerifikasiAction(rekon.id, alasan.trim());
      if ("error" in res) {
        alert(`Gagal: ${res.error}`);
        return;
      }
      router.refresh();
    });
  }

  // Display mode (sudah diverifikasi)
  if (rekon && !editMode) {
    const status =
      rekon.selisih === 0
        ? { label: "✓ Cocok", color: "text-emerald-700 bg-emerald-50" }
        : {
            label: `⚠ Selisih ${rekon.selisih > 0 ? "+" : ""}${formatRupiah(rekon.selisih)}`,
            color: "text-rose-700 bg-rose-50",
          };

    return (
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${badgeColor}`}>
              {label}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${status.color}`}>
              {status.label}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setEditMode(true)}
              disabled={pending}
              className="text-brand hover:bg-brand-soft p-1.5 rounded disabled:opacity-50"
              title="Edit"
            >
              <Edit3 size={14} />
            </button>
            <button
              onClick={handleHapus}
              disabled={pending}
              className="text-red-600 hover:bg-red-50 p-1.5 rounded disabled:opacity-50"
              title="Hapus"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 text-xs">
          <div>
            <div className="text-[10px] text-[color:var(--muted)]">Omzet Sistem</div>
            <div className="font-bold tabular-nums">{formatRupiah(omzetSistem)}</div>
          </div>
          <div>
            <div className="text-[10px] text-[color:var(--muted)]">Saldo Aktual</div>
            <div className="font-bold tabular-nums">{formatRupiah(rekon.saldoAktual)}</div>
          </div>
          <div>
            <div className="text-[10px] text-[color:var(--muted)]">Selisih</div>
            <div
              className={`font-extrabold tabular-nums ${
                rekon.selisih === 0
                  ? "text-[color:var(--muted)]"
                  : rekon.selisih > 0
                    ? "text-blue-700"
                    : "text-rose-700"
              }`}
            >
              {rekon.selisih > 0 ? "+" : ""}
              {formatRupiah(rekon.selisih)}
            </div>
          </div>
        </div>
        {rekon.catatan && (
          <div className="text-[11px] text-[color:var(--muted)] mt-2 italic">
            &quot;{rekon.catatan}&quot;
          </div>
        )}
        <div className="flex items-center justify-between gap-2 flex-wrap mt-1">
          <div className="text-[10px] text-[color:var(--muted)]">
            Diverifikasi {new Date(rekon.verifiedAt).toLocaleString("id-ID", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {rekon.verifiedByName && ` · ${rekon.verifiedByName}`}
          </div>
          {rekon.buktiFotoUrl && (
            <a
              href={rekon.buktiFotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-brand font-bold inline-flex items-center gap-1 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              📷 Lihat bukti
            </a>
          )}
        </div>
        {detail.length > 0 ? (
          <DetailList items={detail} />
        ) : (
          omzetSistem > 0 && (
            <div className="mt-2 text-[10px] text-[color:var(--muted)] italic">
              Detail rincian tidak tersedia (data lama sebelum fitur ini).
            </div>
          )
        )}
      </div>
    );
  }

  // Edit mode / input mode
  return (
    <div className="px-4 py-3 bg-amber-50/30">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${badgeColor}`}>
          {label}
        </span>
        {!rekon && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold inline-flex items-center gap-1">
            <AlertTriangle size={10} /> BELUM DIVERIFIKASI
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
        <div>
          <div className="text-[10px] text-[color:var(--muted)]">Omzet Sistem</div>
          <div className="font-bold tabular-nums">{formatRupiah(omzetSistem)}</div>
        </div>
        <div>
          <label className="text-[10px] text-[color:var(--muted)] font-bold">
            Saldo Aktual (dari mobile banking)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={saldo}
            onChange={(e) => setSaldo(e.target.value.replace(/\D/g, ""))}
            placeholder={String(omzetSistem)}
            className="w-full mt-0.5 px-2 py-1.5 border border-line rounded text-sm font-bold tabular-nums"
            autoFocus={editMode}
          />
        </div>
      </div>

      <div className="text-xs mb-2">
        <span className="text-[10px] text-[color:var(--muted)] font-bold">Selisih: </span>
        <span
          className={`font-extrabold tabular-nums ${
            currentSelisih === 0
              ? "text-emerald-700"
              : currentSelisih > 0
                ? "text-blue-700"
                : "text-rose-700"
          }`}
        >
          {currentSelisih > 0 ? "+" : ""}
          {formatRupiah(currentSelisih)}
        </span>
      </div>

      <div className="mb-2">
        <label className="text-[10px] text-[color:var(--muted)] font-bold">
          Catatan {currentSelisih !== 0 ? "(wajib, min 3 karakter)" : "(opsional)"}
        </label>
        <input
          type="text"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder={
            currentSelisih === 0
              ? "misal: cek malam"
              : "misal: dipotong biaya admin bank Rp 2.500"
          }
          className="w-full mt-0.5 px-2 py-1.5 border border-line rounded text-xs"
        />
      </div>

      <div className="mb-2">
        <label className="text-[10px] text-[color:var(--muted)] font-bold">
          Bukti transfer / screenshot QRIS merchant (opsional)
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="w-full mt-0.5 text-[11px]"
        />
        {fotoBase64 && (
          <div className="text-[10px] text-emerald-700 mt-0.5">
            ✓ {fotoNama} siap upload
          </div>
        )}
        {rekon?.buktiFotoUrl && !fotoBase64 && !hapusBukti && (
          <div className="flex items-center gap-2 mt-1 text-[10px]">
            <a
              href={rekon.buktiFotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand font-bold hover:underline"
            >
              📷 Bukti tersimpan
            </a>
            <button
              type="button"
              onClick={() => setHapusBukti(true)}
              className="text-red-600 hover:underline"
            >
              Hapus bukti
            </button>
          </div>
        )}
        {hapusBukti && (
          <div className="text-[10px] text-red-700 mt-0.5">
            Bukti lama akan dihapus saat simpan.{" "}
            <button
              type="button"
              onClick={() => setHapusBukti(false)}
              className="underline"
            >
              Batal
            </button>
          </div>
        )}
      </div>

      {err && (
        <div className="text-xs text-red-600 font-bold mb-2">{err}</div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={pending}
          className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <Check size={12} /> {pending ? "Menyimpan…" : "Simpan Verifikasi"}
        </button>
        {editMode && (
          <button
            onClick={() => {
              setEditMode(false);
              setErr(null);
              setSaldo(String(rekon?.saldoAktual ?? omzetSistem));
              setCatatan(rekon?.catatan ?? "");
              setFotoBase64(null);
              setFotoMime(null);
              setFotoNama(null);
              setHapusBukti(false);
            }}
            disabled={pending}
            className="px-3 py-1.5 border border-line rounded text-xs font-bold inline-flex items-center gap-1"
          >
            <X size={12} /> Batal
          </button>
        )}
      </div>
      {detail.length > 0 ? (
        <DetailList items={detail} />
      ) : (
        omzetSistem > 0 && (
          <div className="mt-3 text-[10px] text-[color:var(--muted)] italic border-t border-line pt-2">
            Detail rincian tidak tersedia — buka halaman{" "}
            <a href="/admin/laporan/semua" className="text-brand underline">
              Semua Aktivitas
            </a>{" "}
            untuk cari transaksi manual.
          </div>
        )
      )}
    </div>
  );
}

function DetailList({ items }: { items: DetailTx[] }) {
  return (
    <details className="mt-3 group">
      <summary className="cursor-pointer text-[11px] text-brand font-bold inline-flex items-center gap-1 select-none">
        <ChevronDown
          size={12}
          className="transition group-open:rotate-180"
        />
        Lihat {items.length} transaksi rincian
      </summary>
      <div className="mt-2 space-y-1.5 border-t border-line pt-2">
        {items.map((it) => (
          <DetailItem key={`${it.jenis}-${it.id}`} it={it} />
        ))}
      </div>
    </details>
  );
}

function DetailItem({ it }: { it: DetailTx }) {
  const jenisColor =
    it.jenis === "order"
      ? "bg-blue-50 text-blue-700"
      : "bg-violet-50 text-violet-700";
  const jenisLabel = it.jenis === "order" ? "ORDER" : "POS";
  const petugasLabel = it.jenis === "order" ? "Kurir" : "Kasir";
  const shiftBeda =
    it.shiftKasirNama &&
    it.petugasNama &&
    it.shiftKasirNama !== it.petugasNama;

  return (
    <div className="text-[11px] bg-[color:var(--surface2)] rounded-lg px-2.5 py-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`text-[9px] px-1 py-0.5 rounded font-bold shrink-0 ${jenisColor}`}
          >
            {jenisLabel}
          </span>
          <span className="font-mono text-[10px] text-[color:var(--muted)] truncate">
            {it.nomor}
          </span>
          <span className="text-[10px] text-[color:var(--muted)] shrink-0">
            {it.jam}
          </span>
        </div>
        <span className="font-extrabold tabular-nums shrink-0">
          {formatRupiah(it.total)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        <span>
          <span className="text-[color:var(--muted)]">Pelanggan: </span>
          <span className="font-semibold">{it.pelangganNama ?? "—"}</span>
        </span>
        <span>
          <span className="text-[color:var(--muted)]">{petugasLabel}: </span>
          <span className="font-semibold">{it.petugasNama ?? "—"}</span>
        </span>
        {it.shiftKasirNama && (
          <span
            className={
              shiftBeda ? "text-amber-800 font-semibold" : "text-[color:var(--muted)]"
            }
          >
            <span className="text-[color:var(--muted)]">Shift: </span>
            {it.shiftKasirNama}
            {shiftBeda && " ⚠"}
          </span>
        )}
      </div>
    </div>
  );
}
