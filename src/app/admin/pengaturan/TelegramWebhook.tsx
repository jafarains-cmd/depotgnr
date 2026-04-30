"use client";

import { useState, useTransition } from "react";
import { setupTelegramWebhook, deleteTelegramWebhook } from "./actions";

export function TelegramWebhook() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="bg-surface rounded-xl border border-line p-5 space-y-3 mt-4">
      <h2 className="font-semibold">Webhook Telegram</h2>
      <p className="text-sm text-[color:var(--muted)]">
        Daftarkan URL webhook ke Bot API. Pastikan domain publik (bukan localhost) untuk
        produksi — atau pakai ngrok untuk testing.
      </p>
      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await setupTelegramWebhook();
              setMsg({ ok: r.ok, text: r.ok ? "Webhook terdaftar." : r.description ?? "Gagal" });
            })
          }
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm disabled:opacity-50"
        >
          Pasang Webhook
        </button>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await deleteTelegramWebhook();
              setMsg({ ok: r.ok, text: r.ok ? "Webhook dihapus." : r.description ?? "Gagal" });
            })
          }
          className="px-4 py-2 border border-line rounded-md text-sm disabled:opacity-50"
        >
          Hapus Webhook
        </button>
      </div>
      {msg && (
        <div className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
