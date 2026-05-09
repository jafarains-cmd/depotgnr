"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, FileText } from "lucide-react";
import { submitKomplain } from "../actions";
import { compressImage, arrayBufferToBase64 } from "@/lib/image-compress";

const JENIS_OPTIONS = [
  { value: "kotor", label: "Galon kotor / kemasan rusak" },
  { value: "rusak", label: "Air berbau / rasa aneh" },
  { value: "kurang_volume", label: "Volume kurang dari standar" },
  { value: "salah_pesanan", label: "Pesanan tidak sesuai" },
  { value: "lainnya", label: "Lainnya" },
] as const;

type Jenis = (typeof JENIS_OPTIONS)[number]["value"];

export function KomplainForm({
  orders,
}: {
  orders: { id: number; nomorOrder: string; createdAt: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [jenis, setJenis] = useState<Jenis>("kotor");
  const [deskripsi, setDeskripsi] = useState("");
  const [refOrderId, setRefOrderId] = useState<string>("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  function handleFoto(file: File) {
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  function submit() {
    setError(null);
    if (deskripsi.trim().length < 5) {
      setError("Deskripsi minimal 5 karakter");
      return;
    }
    startTransition(async () => {
      try {
        let fotoBase64: string | undefined;
        let fotoMimeType: string | undefined;
        if (fotoFile) {
          const compressed = await compressImage(fotoFile, {
            maxWidth: 1600,
            quality: 0.85,
          });
          const buf = await compressed.arrayBuffer();
          fotoBase64 = arrayBufferToBase64(buf);
          fotoMimeType = compressed.type || "image/jpeg";
        }
        const r = await submitKomplain({
          jenis,
          deskripsi,
          refOrderId: refOrderId ? Number(refOrderId) : undefined,
          fotoBase64,
          fotoMimeType,
        });
        if ("error" in r) {
          setError(r.error);
        } else {
          router.push("/pelanggan/komplain");
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal submit");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1">Jenis Komplain</label>
        <select
          value={jenis}
          onChange={(e) => setJenis(e.target.value as Jenis)}
          className="w-full px-3 py-2 border border-line rounded-md text-sm bg-surface"
        >
          {JENIS_OPTIONS.map((j) => (
            <option key={j.value} value={j.value}>
              {j.label}
            </option>
          ))}
        </select>
      </div>

      {orders.length > 0 && (
        <div>
          <label className="text-xs font-medium block mb-1">
            Terkait Order (opsional)
          </label>
          <select
            value={refOrderId}
            onChange={(e) => setRefOrderId(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-md text-sm bg-surface"
          >
            <option value="">— Tidak terkait order —</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nomorOrder} ·{" "}
                {new Date(o.createdAt).toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  year: "2-digit",
                })}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-xs font-medium block mb-1">
          Cerita Detail Masalah <span className="text-rose-600">*</span>
        </label>
        <textarea
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
          rows={5}
          placeholder="Ceritakan apa yang terjadi, kapan, dan apa yang Anda harapkan..."
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
          required
        />
        <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
          {deskripsi.length}/1000 karakter
        </div>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Foto Bukti (opsional)</label>
        <label className="block">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFoto(f);
            }}
          />
          <div className="cursor-pointer aspect-video bg-[color:var(--surface2)] border-2 border-dashed border-line rounded-lg flex items-center justify-center overflow-hidden hover:border-brand-400">
            {fotoPreview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={fotoPreview}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center text-[color:var(--muted)] text-xs py-6">
                <Camera size={24} className="mx-auto mb-1" />
                Tap untuk upload foto
              </div>
            )}
          </div>
        </label>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 inline-flex items-start gap-2">
        <FileText size={14} className="flex-shrink-0 mt-0.5" />
        <div>
          Komplain akan ditinjau admin. Anda akan dapat notifikasi WA/push saat ada
          tanggapan. Jangan submit komplain palsu — bisa dianggap penyalahgunaan.
        </div>
      </div>

      {error && <div className="text-xs text-rose-600">{error}</div>}

      <button
        onClick={submit}
        disabled={pending || !deskripsi.trim()}
        className="w-full py-2.5 bg-brand-600 text-white rounded-md text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        {pending ? "Mengirim..." : "Kirim Komplain"}
      </button>
    </div>
  );
}
