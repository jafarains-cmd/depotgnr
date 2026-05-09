"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cloud, Loader2 } from "lucide-react";
import { triggerBackupNow } from "./actions";

export function BackupActions() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function handleTrigger() {
    if (
      !confirm(
        "Backup sekarang? Proses memakan waktu beberapa detik tergantung ukuran database.",
      )
    )
      return;
    setMsg(null);
    startTransition(async () => {
      const r = await triggerBackupNow();
      if ("error" in r) {
        setMsg({ ok: false, text: r.error });
      } else {
        const sizeMb = (r.sizeBytes / 1024 / 1024).toFixed(2);
        setMsg({ ok: true, text: `Backup sukses (${sizeMb} MB)` });
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-brand-soft border border-brand rounded-2xl p-4 flex flex-col">
      <div className="text-[10px] font-bold tracking-widest text-brand">
        BACKUP MANUAL
      </div>
      <button
        onClick={handleTrigger}
        disabled={pending}
        className="mt-2 px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        {pending ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Sedang backup...
          </>
        ) : (
          <>
            <Cloud size={14} /> Backup Sekarang
          </>
        )}
      </button>
      {msg && (
        <div
          className={`text-xs mt-2 ${
            msg.ok ? "text-emerald-700" : "text-rose-600"
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
