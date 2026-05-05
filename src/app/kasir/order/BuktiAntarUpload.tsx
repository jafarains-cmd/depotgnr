"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { uploadBuktiAntarStaff } from "./actions";

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function BuktiAntarUpload({ orderId, hasBukti }: { orderId: number; hasBukti: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);
    startTransition(async () => {
      const buf = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);
      const r = await uploadBuktiAntarStaff({
        orderId,
        base64,
        mimeType: file.type || "image/jpeg",
        replace: hasBukti,
      });
      if ("error" in r) {
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="pt-1">
      <label className="inline-flex items-center gap-1.5 text-xs px-2 py-1 border border-line rounded-md cursor-pointer hover:border-brand-400 hover:text-brand">
        {pending ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
        {pending ? "Mengunggah..." : hasBukti ? "Ganti bukti antar" : "Upload bukti antar"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={pending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </label>
      {error && <div className="text-[11px] text-red-600 mt-1">{error}</div>}
    </div>
  );
}
