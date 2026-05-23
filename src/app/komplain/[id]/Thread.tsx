"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { kirimPesanKomplain, tandaiBacaKomplain } from "./actions";

export type Pesan = {
  id: number;
  senderUserId: string;
  senderRole: "pelanggan" | "staff";
  senderNama: string;
  pesan: string;
  createdAt: string;
};

export function KomplainThread({
  komplainId,
  pesanList,
  meRole,
}: {
  komplainId: number;
  pesanList: Pesan[];
  meRole: "pelanggan" | "staff";
}) {
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll ke bawah saat ada pesan baru
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pesanList.length]);

  // Tandai pesan lawan sebagai dibaca sekali saat mount
  useEffect(() => {
    tandaiBacaKomplain(komplainId).catch(() => {});
  }, [komplainId]);

  function handleKirim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const text = draft.trim();
    if (!text) return;
    startTransition(async () => {
      const r = await kirimPesanKomplain(komplainId, text);
      if ("error" in r) {
        setError(r.error);
      } else {
        setDraft("");
      }
    });
  }

  return (
    <div className="bg-surface border border-line rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-line">
        <h2 className="font-bold">💬 Chat Komplain</h2>
        <p className="text-xs text-[color:var(--muted)]">
          Diskusi langsung antara pelanggan & admin. Tersimpan untuk audit.
        </p>
      </div>

      <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto bg-[color:var(--surface2)]/30">
        {pesanList.length === 0 ? (
          <div className="text-center text-xs text-[color:var(--muted)] py-8">
            Belum ada pesan. {meRole === "staff" ? "Sapa pelanggan" : "Ceritakan masalah Anda"} lebih lanjut di bawah.
          </div>
        ) : (
          pesanList.map((p) => {
            const isMe = p.senderRole === meRole;
            return (
              <div
                key={p.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    isMe
                      ? "bg-brand text-white rounded-br-sm"
                      : "bg-white border border-line rounded-bl-sm"
                  }`}
                >
                  {!isMe && (
                    <div className="text-[10px] font-bold text-[color:var(--muted)] mb-0.5">
                      {p.senderNama}{" "}
                      <span className="opacity-70">
                        ({p.senderRole === "staff" ? "Admin" : "Pelanggan"})
                      </span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{p.pesan}</div>
                  <div
                    className={`text-[9px] mt-1 ${
                      isMe ? "text-white/70 text-right" : "text-[color:var(--muted)]"
                    }`}
                  >
                    {new Date(p.createdAt).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleKirim} className="border-t border-line p-3">
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleKirim(e);
              }
            }}
            placeholder={
              meRole === "staff"
                ? "Tulis balasan ke pelanggan…"
                : "Tulis pesan ke admin…"
            }
            rows={2}
            disabled={pending}
            className="flex-1 px-3 py-2 border border-line rounded-md text-sm resize-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="px-4 bg-brand text-white rounded-md font-bold inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
        {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
        <p className="text-[10px] text-[color:var(--muted)] mt-1">
          Enter untuk kirim · Shift+Enter untuk baris baru
        </p>
      </form>
    </div>
  );
}
