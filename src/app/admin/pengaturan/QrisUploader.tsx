"use client";

import { useState, useTransition } from "react";
import { Upload, Check, Loader2 } from "lucide-react";
import { uploadQrisFoto } from "./actions";
import { normalizeDriveUrl } from "@/lib/drive-url";

export function QrisUploader({ currentUrl }: { currentUrl: string | null }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState(currentUrl);

  function handleFile(f: File) {
    setMsg(null);
    startTransition(async () => {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      const res = await uploadQrisFoto({
        base64,
        mimeType: f.type || "image/jpeg",
      });
      if ("error" in res) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: "QRIS berhasil diupload & tersimpan" });
        setPreviewUrl(res.url);
      }
    });
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <div className="text-sm font-semibold inline-flex items-center gap-1.5">
        <Upload size={16} /> Upload Gambar QRIS
      </div>
      <p className="text-xs text-[color:var(--muted)]">
        Pilih file gambar QRIS depot. Setelah upload, otomatis tersimpan ke folder Drive
        dan field "URL Gambar QRIS Statis" terisi.
      </p>

      {previewUrl && (
        <div className="border border-line rounded-md p-2 inline-block bg-[color:var(--surface2)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={normalizeDriveUrl(previewUrl)}
            alt="QRIS"
            className="w-40 h-40 object-contain"
          />
        </div>
      )}

      <label className="block">
        <input
          type="file"
          accept="image/*"
          disabled={pending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="hidden"
        />
        <span
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm cursor-pointer ${
            pending
              ? "bg-[color:var(--surface2)] text-[color:var(--muted)]"
              : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          {pending ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Mengupload...
            </>
          ) : (
            <>
              <Upload size={14} />
              {previewUrl ? "Ganti Gambar QRIS" : "Pilih Gambar QRIS"}
            </>
          )}
        </span>
      </label>

      {msg && (
        <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
          {msg.ok && <Check size={12} className="inline" />} {msg.text}
        </p>
      )}
    </div>
  );
}
