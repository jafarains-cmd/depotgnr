"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus } from "lucide-react";
import { adjustLoyaltyManual } from "../actions";

export function LoyaltyAdjustForm({ pelangganId }: { pelangganId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [arah, setArah] = useState<"plus" | "minus">("plus");
  const [jumlah, setJumlah] = useState("");
  const [alasan, setAlasan] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function submit() {
    const n = parseInt(jumlah, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setMsg({ ok: false, text: "Jumlah harus angka positif" });
      return;
    }
    const signed = arah === "plus" ? n : -n;
    setMsg(null);
    startTransition(async () => {
      const r = await adjustLoyaltyManual(pelangganId, signed, alasan);
      if ("error" in r) {
        setMsg({ ok: false, text: r.error });
      } else {
        setMsg({ ok: true, text: "Saldo loyalty berhasil disesuaikan." });
        setJumlah("");
        setAlasan("");
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="font-bold text-sm">Adjust Saldo Manual</h3>
        <p className="text-xs text-[color:var(--muted)]">
          Khusus admin. Tambah/kurangi saldo dengan alasan jelas (audit trail).
          Saldo tidak bisa minus.
        </p>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-2 items-stretch">
        <div className="flex">
          <button
            onClick={() => setArah("plus")}
            className={`px-3 rounded-l-md border ${
              arah === "plus"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "border-line text-[color:var(--muted)]"
            }`}
            type="button"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => setArah("minus")}
            className={`px-3 rounded-r-md border-l-0 border ${
              arah === "minus"
                ? "bg-red-600 text-white border-red-600"
                : "border-line text-[color:var(--muted)]"
            }`}
            type="button"
          >
            <Minus size={14} />
          </button>
        </div>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={jumlah}
          onChange={(e) => setJumlah(e.target.value)}
          placeholder="Jumlah (Rp)"
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
        />
      </div>
      <textarea
        value={alasan}
        onChange={(e) => setAlasan(e.target.value)}
        placeholder="Alasan (mis: kompensasi keluhan, promo manual, koreksi salah input)"
        rows={2}
        className="w-full px-3 py-2 border border-line rounded-md text-sm"
      />
      <div className="flex justify-end items-center gap-3">
        {msg && (
          <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
            {msg.text}
          </span>
        )}
        <button
          onClick={submit}
          disabled={pending || !jumlah || alasan.trim().length < 3}
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Simpan Adjust"}
        </button>
      </div>
    </div>
  );
}
