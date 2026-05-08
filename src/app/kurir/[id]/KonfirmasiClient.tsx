"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, Truck, ArrowDownToLine, Droplet } from "lucide-react";
import { compressImage } from "@/lib/image-compress";
import {
  konfirmasiDiantar,
  mulaiAntar,
  konfirmasiJemput,
  tandaiDiisi,
} from "../actions";

type Tipe = "antar-saja" | "jemput-antar";

export function KonfirmasiClient({
  orderId,
  status,
  tipe,
}: {
  orderId: number;
  status: string;
  tipe: Tipe;
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

  function clearFile() {
    setFile(null);
    setPreview(null);
  }

  async function fileToBase64(f: File): Promise<string> {
    const buf = await f.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  if (status === "selesai") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 text-sm inline-flex items-center gap-2">
        <Check size={16} /> Order sudah diselesaikan.
      </div>
    );
  }

  // === Jemput-antar flow ===
  if (tipe === "jemput-antar") {
    if (status === "pending" || status === "diproses") {
      return (
        <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          <div className="text-sm font-semibold inline-flex items-center gap-1.5">
            <ArrowDownToLine size={16} /> Jemput Galon Kosong
          </div>
          <p className="text-xs text-[color:var(--muted)]">
            Datangi pelanggan, ambil galon kosong. Foto bukti opsional.
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
            <div className="cursor-pointer aspect-video bg-[color:var(--surface2)] border-2 border-dashed border-line rounded-lg flex items-center justify-center overflow-hidden hover:border-brand-400">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Bukti jemput" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-[color:var(--muted)] text-sm py-6">
                  <Camera size={28} className="mx-auto mb-1" />
                  Foto galon kosong (opsional)
                </div>
              )}
            </div>
          </label>
          {preview && (
            <button
              onClick={clearFile}
              className="text-xs text-[color:var(--muted)] hover:text-red-600"
            >
              Hapus foto
            </button>
          )}

          {msg && (
            <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>
          )}

          <button
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                try {
                  const args: Parameters<typeof konfirmasiJemput>[0] = { orderId };
                  if (file) {
                    const f = await compressImage(file, { maxWidth: 1600, quality: 0.85 });
                    args.buktiBase64 = await fileToBase64(f);
                    args.mimeType = f.type || "image/jpeg";
                  }
                  const res = await konfirmasiJemput(args);
                  if ("error" in res) setMsg({ ok: false, text: res.error });
                  else router.refresh();
                } catch (e) {
                  setMsg({ ok: false, text: e instanceof Error ? e.message : "Gagal upload" });
                }
              });
            }}
            disabled={pending}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {pending ? <Loader2 className="animate-spin" size={18} /> : <ArrowDownToLine size={18} />}
            Galon Sudah Dijemput
          </button>
        </div>
      );
    }

    if (status === "dijemput") {
      return (
        <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          <div className="text-sm font-semibold inline-flex items-center gap-1.5">
            <Droplet size={16} /> Isi Galon di Depot
          </div>
          <p className="text-xs text-[color:var(--muted)]">
            Setelah galon selesai diisi di depot, klik tombol di bawah.
          </p>
          {msg && (
            <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>
          )}
          <button
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                const res = await tandaiDiisi(orderId);
                if ("error" in res) setMsg({ ok: false, text: res.error });
                else router.refresh();
              });
            }}
            disabled={pending}
            className="w-full py-3 bg-cyan-600 text-white rounded-lg font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {pending ? <Loader2 className="animate-spin" size={18} /> : <Droplet size={18} />}
            Selesai Diisi
          </button>
        </div>
      );
    }

    if (status === "diisi") {
      return (
        <MulaiAntarBlock
          orderId={orderId}
          pending={pending}
          startTransition={startTransition}
          msg={msg}
          setMsg={setMsg}
        />
      );
    }
  }

  // === Antar-saja flow ===
  if (status === "diproses") {
    return (
      <MulaiAntarBlock
        orderId={orderId}
        pending={pending}
        startTransition={startTransition}
        msg={msg}
        setMsg={setMsg}
      />
    );
  }

  // === Status diantar (sama untuk kedua tipe) ===
  if (status === "diantar") {
    return (
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
        <div className="text-sm font-semibold inline-flex items-center gap-1.5">
          <Camera size={16} /> Upload Bukti Pengantaran
        </div>
        <p className="text-xs text-[color:var(--muted)]">
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
          <div className="cursor-pointer aspect-video bg-[color:var(--surface2)] border-2 border-dashed border-line rounded-lg flex items-center justify-center overflow-hidden hover:border-brand-400">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Bukti" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-[color:var(--muted)] text-sm py-6">
                <Camera size={28} className="mx-auto mb-1" />
                Tap untuk ambil foto / pilih gambar
              </div>
            )}
          </div>
        </label>

        {msg && (
          <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>
        )}

        <button
          onClick={() => {
            if (!file) {
              setMsg({ ok: false, text: "Pilih foto bukti dulu" });
              return;
            }
            setMsg(null);
            startTransition(async () => {
              try {
                const f = await compressImage(file, { maxWidth: 1600, quality: 0.85 });
                const base64 = await fileToBase64(f);
                const res = await konfirmasiDiantar({
                  orderId,
                  buktiBase64: base64,
                  mimeType: f.type || "image/jpeg",
                });
                if ("error" in res) {
                  setMsg({ ok: false, text: res.error });
                } else {
                  setMsg({ ok: true, text: "Order berhasil diselesaikan" });
                  setTimeout(() => router.push("/kurir"), 1200);
                }
              } catch (e) {
                setMsg({ ok: false, text: e instanceof Error ? e.message : "Gagal upload" });
              }
            });
          }}
          disabled={pending || !file}
          className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {pending ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
          {pending ? "Mengupload..." : "Konfirmasi Sudah Diantar"}
        </button>
      </div>
    );
  }

  return null;
}

function MulaiAntarBlock({
  orderId,
  pending,
  startTransition,
  msg,
  setMsg,
}: {
  orderId: number;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  msg: { ok?: boolean; text: string } | null;
  setMsg: (m: { ok?: boolean; text: string } | null) => void;
}) {
  const router = useRouter();
  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      {msg && (
        <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>
      )}
      <button
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const res = await mulaiAntar(orderId);
            if ("error" in res) setMsg({ ok: false, text: res.error });
            else router.refresh();
          });
        }}
        disabled={pending}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {pending ? <Loader2 className="animate-spin" size={18} /> : <Truck size={18} />}
        Mulai Antar
      </button>
    </div>
  );
}
