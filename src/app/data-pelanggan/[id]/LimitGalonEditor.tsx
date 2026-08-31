"use client";

import { useState, useTransition } from "react";
import { Package, Edit2, Check, X } from "lucide-react";
import { updateLimitGalon } from "@/app/admin/langganan-pending/actions";
import { useToast } from "@/components/Toast";

type Props = {
  pelangganId: number;
  currentLimit: number | null;
  effectiveLimit: number;
  defaultLimit: number;
  galonDipegang: number;
};

export function LimitGalonEditor({
  pelangganId,
  currentLimit,
  effectiveLimit,
  defaultLimit,
  galonDipegang,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(
    currentLimit !== null && currentLimit !== undefined ? String(currentLimit) : "",
  );
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function save() {
    const trimmed = value.trim();
    const num = trimmed === "" ? null : Number(trimmed);
    if (num !== null && (!Number.isInteger(num) || num < 0 || num > 1000)) {
      toast.error("Limit harus 0-1000, atau kosongkan untuk pakai default");
      return;
    }
    startTransition(async () => {
      const res = await updateLimitGalon(pelangganId, num);
      if (res.ok) {
        toast.success("Limit galon di-update");
        setEditing(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <Package size={16} className="text-blue-700" />
          <div className="text-xs font-bold text-blue-900">Pinjaman Galon Depot</div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] text-blue-700 hover:underline inline-flex items-center gap-0.5"
          >
            <Edit2 size={11} /> Ubah limit
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <div className="text-lg font-extrabold text-blue-900">
            {galonDipegang} / {effectiveLimit}
          </div>
          <div className="text-[10px] text-blue-700">
            {currentLimit !== null && currentLimit !== undefined
              ? "Limit di-override khusus akun ini"
              : `Pakai default global (${defaultLimit})`}
          </div>
        </div>
        {editing && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={1000}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={String(defaultLimit)}
              className="w-20 px-2 py-1 border border-blue-300 rounded text-sm text-center"
              autoFocus
            />
            <button
              onClick={save}
              disabled={pending}
              className="w-7 h-7 rounded bg-emerald-600 text-white grid place-items-center disabled:opacity-50"
              title="Simpan"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setValue(
                  currentLimit !== null && currentLimit !== undefined
                    ? String(currentLimit)
                    : "",
                );
              }}
              disabled={pending}
              className="w-7 h-7 rounded bg-slate-200 grid place-items-center"
              title="Batal"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
      {editing && (
        <div className="mt-1 text-[10px] text-blue-700">
          Kosongkan untuk pakai default global (saat ini {defaultLimit}).
        </div>
      )}
    </div>
  );
}
