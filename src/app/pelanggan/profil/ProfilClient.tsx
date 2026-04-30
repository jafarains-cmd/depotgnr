"use client";

import { useState, useTransition } from "react";
import { Send, Unlink } from "lucide-react";
import { generateTelegramLink, unlinkTelegram } from "./actions";

export function ProfilClient({
  telegramLinked,
  telegramChatId,
}: {
  telegramLinked: boolean;
  telegramChatId: string | null;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold inline-flex items-center gap-1.5">
        <Send size={16} /> Notifikasi Telegram
      </h2>

      {telegramLinked ? (
        <>
          <p className="text-sm text-emerald-700">
            ✓ Akun terhubung (chat id: <code>{telegramChatId}</code>)
          </p>
          <button
            onClick={() => {
              if (confirm("Putuskan koneksi Telegram?")) {
                startTransition(async () => {
                  await unlinkTelegram();
                });
              }
            }}
            className="text-sm text-red-600 inline-flex items-center gap-1"
          >
            <Unlink size={14} /> Putuskan
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-[color:var(--muted)]">
            Hubungkan akun untuk dapat notifikasi update order via Telegram.
          </p>
          {code ? (
            <div className="bg-brand-50 border border-brand-200 rounded-md p-3 text-sm">
              <div>1. Buka bot Telegram depot Anda.</div>
              <div className="my-2">
                2. Kirim pesan: <code className="bg-surface px-2 py-0.5 rounded font-mono text-base">/start {code}</code>
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                Kode berlaku 10 menit. Refresh halaman setelah kirim untuk verifikasi.
              </div>
            </div>
          ) : (
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await generateTelegramLink();
                  setCode(res.code);
                })
              }
              className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm disabled:opacity-50"
            >
              {pending ? "Generating..." : "Generate Kode"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
