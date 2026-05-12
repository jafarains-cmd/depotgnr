"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Unlink, Search, Check, X, Loader2, UserPlus } from "lucide-react";
import {
  linkPelangganToUser,
  unlinkPelangganFromUser,
  searchUsersWithoutPelanggan,
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
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<
    { id: string; name: string; email: string; phoneNumber: string | null }[]
  >([]);
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
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
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
        {!searching && (
          <button
            onClick={() => setSearching(true)}
            className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-md inline-flex items-center gap-1"
          >
            <Link2 size={12} /> Hubungkan
          </button>
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
