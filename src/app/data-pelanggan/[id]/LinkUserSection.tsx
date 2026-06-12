"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Unlink, Search, Check, X, Loader2, UserPlus, Merge } from "lucide-react";
import {
  linkPelangganToUser,
  unlinkPelangganFromUser,
  searchUsersWithoutPelanggan,
  searchPelangganTujuanMerge,
  mergePelanggan,
} from "../actions";

export function LinkUserSection({
  pelangganId,
  pelangganNama,
  currentUserId,
  currentUserName,
  currentUserEmail,
  currentUserTelp,
}: {
  pelangganId: number;
  pelangganNama: string;
  currentUserId: string | null;
  currentUserName: string | null;
  currentUserEmail: string | null;
  currentUserTelp: string | null;
}) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [merging, setMerging] = useState(false);
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<
    { id: string; name: string; email: string; phoneNumber: string | null }[]
  >([]);
  const [mergeResults, setMergeResults] = useState<
    { id: number; nama: string; telp: string | null; userId: string | null }[]
  >([]);
  const [mergeQ, setMergeQ] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function doSearch() {
    setMsg(null);
    if (q.trim().length < 2) {
      setMsg({ ok: false, text: "Minimal 2 karakter untuk cari" });
      return;
    }
    startTransition(async () => {
      const r = await searchUsersWithoutPelanggan(q);
      setResults(r);
      if (r.length === 0) {
        setMsg({ ok: false, text: "Tidak ada user yang cocok (atau sudah terhubung)" });
      }
    });
  }

  function doLink(userId: string, userName: string) {
    if (!confirm(`Hubungkan record pelanggan "${pelangganNama}" ke akun ${userName}?`)) return;
    startTransition(async () => {
      const r = await linkPelangganToUser(pelangganId, userId);
      if ("error" in r) {
        setMsg({ ok: false, text: r.error });
      } else {
        setMsg({ ok: true, text: `Berhasil terhubung ke ${userName}` });
        setSearching(false);
        setResults([]);
        setQ("");
        router.refresh();
      }
    });
  }

  function doMergeSearch() {
    setMsg(null);
    if (mergeQ.trim().length < 2) {
      setMsg({ ok: false, text: "Minimal 2 karakter" });
      return;
    }
    startTransition(async () => {
      const r = await searchPelangganTujuanMerge(mergeQ, pelangganId);
      setMergeResults(r);
      if (r.length === 0) setMsg({ ok: false, text: "Tidak ada pelanggan yang cocok" });
    });
  }

  function doMerge(targetId: number, targetNama: string) {
    if (
      !confirm(
        `GABUNGKAN "${pelangganNama}" → "${targetNama}"?\n\n` +
          `Semua data (order, transaksi, saldo loyalty, stamp, titipan, komplain) ` +
          `akan dipindahkan ke "${targetNama}".\n\n` +
          `"${pelangganNama}" (walk-in) akan DIHAPUS setelah merge.\n\n` +
          `Tindakan ini TIDAK BISA di-undo.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await mergePelanggan(pelangganId, targetId);
      if ("error" in r) {
        setMsg({ ok: false, text: r.error });
      } else {
        setMsg({ ok: true, text: `Berhasil digabung: ${r.summary}` });
        setTimeout(() => router.push(`/data-pelanggan/${targetId}`), 1500);
      }
    });
  }

  function doUnlink() {
    if (
      !confirm(
        `Putuskan koneksi pelanggan dari akun login? Pelanggan akan jadi walk-in lagi. History tetap.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await unlinkPelangganFromUser(pelangganId);
      if ("error" in r) setMsg({ ok: false, text: r.error });
      else router.refresh();
    });
  }

  // Sudah terhubung
  if (currentUserId) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold text-emerald-900 inline-flex items-center gap-1.5">
              <Link2 size={14} /> Terhubung dengan Akun Login
            </div>
            <div className="text-xs text-emerald-800 mt-1 space-y-0.5">
              <div>
                <strong>{currentUserName}</strong>
                {currentUserEmail && (
                  <span className="ml-2 text-[color:var(--muted)]">{currentUserEmail}</span>
                )}
              </div>
              {currentUserTelp && (
                <div className="text-[color:var(--muted)]">📞 {currentUserTelp}</div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setSearching(false); setMerging(true); }}
              disabled={pending}
              className="text-xs text-violet-700 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
              title="Gabung dengan pelanggan lain"
            >
              <Merge size={11} /> Gabung
            </button>
            <button
              onClick={doUnlink}
              disabled={pending}
              className="text-xs text-amber-700 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
              title="Putuskan koneksi"
            >
              <Unlink size={11} /> Putuskan
            </button>
          </div>
        </div>

        {merging && (
          <div className="border-t border-emerald-200 pt-3 space-y-2">
            <div className="text-xs text-emerald-900 mb-1">
              Pilih pelanggan tujuan — semua data dari record ini akan dipindahkan
              ke target, record ini akan dihapus.
            </div>
            <div className="flex gap-1">
              <input
                value={mergeQ}
                onChange={(e) => setMergeQ(e.target.value)}
                placeholder="Cari nama / telp..."
                className="flex-1 px-2 py-1.5 border border-line rounded-md text-xs"
              />
              <button
                onClick={doMergeSearch}
                disabled={pending}
                className="px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-md disabled:opacity-50"
              >
                Cari
              </button>
              <button
                onClick={() => { setMerging(false); setMergeResults([]); }}
                className="px-2 py-1.5 text-[color:var(--muted)] text-xs"
              >
                Batal
              </button>
            </div>
            {mergeResults.length > 0 && (
              <div className="space-y-1">
                {mergeResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => doMerge(r.id, r.nama)}
                    disabled={pending}
                    className="w-full text-left bg-white border border-line rounded-md p-2 hover:border-violet-300 disabled:opacity-50"
                  >
                    <div className="text-sm font-bold">{r.nama}</div>
                    <div className="text-[10px] text-[color:var(--muted)]">
                      {r.telp ?? "-"} · {r.userId ? "Ber-akun" : "Walk-in"}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {msg && (
              <div
                className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}
              >
                {msg.text}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Belum terhubung
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-bold text-amber-900 inline-flex items-center gap-1.5">
            <UserPlus size={14} /> Pelanggan Walk-in (Belum Punya Akun Login)
          </div>
          <p className="text-xs text-amber-800 mt-1">
            Record ini dibuat manual. Hubungkan ke akun user kalau pelanggan sudah
            register sendiri — supaya history & loyalty tidak duplikat.
          </p>
        </div>
        {!searching && !merging && (
          <div className="flex gap-1">
            <button
              onClick={() => { setMerging(false); setSearching(true); }}
              className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-md inline-flex items-center gap-1"
            >
              <Link2 size={12} /> Hubungkan
            </button>
            <button
              onClick={() => { setSearching(false); setMerging(true); }}
              className="px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-md inline-flex items-center gap-1"
            >
              <Merge size={12} /> Gabung
            </button>
          </div>
        )}
      </div>

      {searching && (
        <div className="space-y-2 pt-2 border-t border-amber-200">
          <div className="flex gap-2 items-center">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari user by nama / email / username / telp..."
              className="flex-1 px-3 py-2 border border-line rounded-md text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  doSearch();
                }
              }}
            />
            <button
              onClick={doSearch}
              disabled={pending || q.trim().length < 2}
              className="px-3 py-2 bg-amber-600 text-white rounded-md text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
            >
              {pending ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              Cari
            </button>
            <button
              onClick={() => {
                setSearching(false);
                setQ("");
                setResults([]);
                setMsg(null);
              }}
              className="px-2 py-2 text-[color:var(--muted)] hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>

          {results.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {results.map((u) => (
                <button
                  key={u.id}
                  onClick={() => doLink(u.id, u.name)}
                  disabled={pending}
                  className="w-full text-left bg-surface border border-line rounded-md p-2 hover:border-brand transition flex items-center justify-between gap-2 text-xs disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <div className="font-bold">{u.name}</div>
                    <div className="text-[10px] text-[color:var(--muted)]">
                      {u.email}
                      {u.phoneNumber && ` · ${u.phoneNumber}`}
                    </div>
                  </div>
                  <Check size={14} className="text-brand flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {merging && (
        <div className="space-y-2 pt-2 border-t border-amber-200">
          <div className="text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded p-2">
            <b>Gabung Pelanggan:</b> Pindahkan semua data (order, transaksi, saldo, stamp,
            titipan, komplain) dari <b>{pelangganNama}</b> ke pelanggan tujuan.
            Record walk-in ini akan dihapus setelah merge.
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="search"
              value={mergeQ}
              onChange={(e) => setMergeQ(e.target.value)}
              placeholder="Cari pelanggan tujuan (yang punya akun)..."
              className="flex-1 px-3 py-2 border border-line rounded-md text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  doMergeSearch();
                }
              }}
            />
            <button
              onClick={doMergeSearch}
              disabled={pending || mergeQ.trim().length < 2}
              className="px-3 py-2 bg-violet-600 text-white rounded-md text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
            >
              {pending ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              Cari
            </button>
            <button
              onClick={() => {
                setMerging(false);
                setMergeQ("");
                setMergeResults([]);
                setMsg(null);
              }}
              className="px-2 py-2 text-[color:var(--muted)] hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>

          {mergeResults.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {mergeResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => doMerge(p.id, p.nama)}
                  disabled={pending}
                  className="w-full text-left bg-surface border border-line rounded-md p-2 hover:border-violet-500 transition flex items-center justify-between gap-2 text-xs disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <div className="font-bold">{p.nama}</div>
                    <div className="text-[10px] text-[color:var(--muted)]">
                      {p.telp ?? "-"}
                      {p.userId && " · Punya akun login"}
                    </div>
                  </div>
                  <Merge size={14} className="text-violet-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {msg && (
        <div
          className={`text-xs ${
            msg.ok ? "text-emerald-700" : "text-rose-600"
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
