"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, Truck } from "lucide-react";
import { konfirmasiDiantar, mulaiAntar } from "../actions";

export function KonfirmasiClient({
  orderId,
  status,
}: {
  orderId: number;
  status: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  function handlePick(f: File) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMsg(null);
  }

  function handleStart() {
    setMsg(null);
    startTransition(async () => {
      const res = await mulaiAntar(orderId);
      if ("error" in res) setMsg({ ok: false, text: res.error });
      else router.refresh();
    });
  }

  function handleSubmit() {
    if (!file) {
      setMsg({ ok: false, text: "Pilih foto bukti dulu" });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const buf = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);
      const res = await konfirmasiDiantar({
        orderId,
        buktiBase64: base64,
        mimeType: file.type || "image/jpeg",
      });
      if ("error" in res) {
        setMsg({ ok: false, text: res.error });
      } else {
        setMsg({ ok: true, text: "Order berhasil diselesaikan" });
        setTimeout(() => router.push("/kurir"), 1200);
      }
    });
  }

  if (status === "selesai") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 text-sm inline-flex items-center gap-2">
        <Check size={16} /> Order sudah diselesaikan.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      {status === "diproses" && (
        <button
          onClick={handleStart}
          disabled={pending}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {pending ? <Loader2 className="animate-spin" size={18} /> : <Truck size={18} />}
          Mulai Antar
        </button>
      )}

      {status === "diantar" && (
        <>
          <div className="text-sm font-semibold inline-flex items-center gap-1.5">
            <Camera size={16} /> Upload Bukti Pengantaran
          </div>
          <p className="text-xs text-slate-600">
            Foto galon di tempat pengantaran atau tanda terima dari pelanggan.
          </p>

          <label className="block">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePick(f);
              }}
              className="hidden"
            />
            <div className="cursor-pointer aspect-video bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden hover:border-brand-400">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Bukti" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-slate-400 text-sm py-6">
                  <Camera size={28} className="mx-auto mb-1" />
                  Tap untuk ambil foto / pilih gambar
                </div>
              )}
            </div>
          </label>

          {msg && (
            <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
              {msg.text}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={pending || !file}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {pending ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
            {pending ? "Mengupload..." : "Konfirmasi Sudah Diantar"}
          </button>
        </>
      )}
    </div>
  );
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
