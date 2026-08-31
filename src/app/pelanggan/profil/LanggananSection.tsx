"use client";

import { useRef, useState, useTransition } from "react";
import { BadgeCheck, ShieldAlert, Hourglass, Upload, X, Package } from "lucide-react";
import { submitLangganan } from "./langganan-actions";
import { useToast } from "@/components/Toast";

type Props = {
  tipe: "umum" | "langganan_pending" | "langganan" | "langganan_ditolak";
  ktpDitolakAlasan: string | null;
  ktpUploadedAt: Date | null;
  ktpVerifiedAt: Date | null;
  galonDipegang: number;
  limitGalon: number;
  syarat: string;
  hasAlamatDanTelp: boolean;
};

export function LanggananSection({
  tipe,
  ktpDitolakAlasan,
  ktpUploadedAt,
  ktpVerifiedAt,
  galonDipegang,
  limitGalon,
  syarat,
  hasAlamatDanTelp,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  function pickFile() {
    inputRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (JPG / PNG)");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maks 5 MB");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit() {
    if (!file || !preview) return;
    const base64 = preview.split(",")[1] ?? "";
    if (!base64) {
      toast.error("Gagal baca file, coba lagi");
      return;
    }
    startTransition(async () => {
      const res = await submitLangganan({ base64, mimeType: file.type });
      if (res.ok) {
        toast.success("Pengajuan langganan terkirim! Admin akan verifikasi <24 jam.");
        setShowForm(false);
        reset();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="mt-4">
      <div className="text-[11px] font-bold tracking-widest text-[color:var(--muted)] mb-2 px-1">
        LANGGANAN GALON DEPOT
      </div>

      {tipe === "langganan" && (
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white grid place-items-center flex-shrink-0">
              <BadgeCheck size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-emerald-900">Anda adalah Langganan ✓</div>
              {ktpVerifiedAt && (
                <div className="text-[11px] text-emerald-800 mt-0.5">
                  Terverifikasi {ktpVerifiedAt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 bg-white/60 rounded-xl p-3">
            <Package size={22} className="text-emerald-700" />
            <div className="flex-1">
              <div className="text-[11px] text-emerald-800 font-semibold">Galon Depot yang Dipinjam</div>
              <div className="text-lg font-extrabold text-emerald-900">
                {galonDipegang} / {limitGalon}
              </div>
              {galonDipegang >= limitGalon && (
                <div className="text-[11px] text-amber-800 mt-0.5">
                  Limit tercapai. Kembalikan atau hubungi admin untuk naikkan limit.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tipe === "langganan_pending" && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white grid place-items-center flex-shrink-0">
              <Hourglass size={20} />
            </div>
            <div className="flex-1">
              <div className="font-extrabold text-amber-900">Menunggu Verifikasi Admin</div>
              <div className="text-xs text-amber-800 mt-1">
                Foto KTP Anda diterima {ktpUploadedAt?.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) ?? "—"}. Verifikasi biasanya &lt;24 jam. Anda akan dapat notifikasi WA setelah disetujui.
              </div>
            </div>
          </div>
        </div>
      )}

      {tipe === "langganan_ditolak" && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500 text-white grid place-items-center flex-shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div className="flex-1">
              <div className="font-extrabold text-rose-900">Pengajuan Ditolak</div>
              {ktpDitolakAlasan && (
                <div className="text-xs text-rose-800 mt-1">Alasan: {ktpDitolakAlasan}</div>
              )}
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition"
              >
                Ajukan Ulang
              </button>
            </div>
          </div>
        </div>
      )}

      {tipe === "umum" && !showForm && (
        <div className="bg-surface border border-line rounded-2xl p-4">
          <div className="font-bold text-sm mb-2">Belum jadi Langganan?</div>
          <p className="text-xs text-[color:var(--muted)] whitespace-pre-line leading-relaxed mb-3">
            {syarat}
          </p>
          {!hasAlamatDanTelp && (
            <div className="mb-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
              ⚠ Lengkapi alamat + nomor WhatsApp di menu <b>Edit profil & akun</b> dulu.
            </div>
          )}
          <button
            onClick={() => setShowForm(true)}
            disabled={!hasAlamatDanTelp}
            className="w-full py-2.5 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
          >
            Ajukan Jadi Langganan
          </button>
        </div>
      )}

      {(tipe === "umum" || tipe === "langganan_ditolak") && showForm && (
        <div className="bg-surface border border-line rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-sm">Upload Foto KTP</div>
            <button
              onClick={() => {
                setShowForm(false);
                reset();
              }}
              className="text-[color:var(--muted)]"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-xs text-[color:var(--muted)] mb-3">
            Ambil foto KTP asli, pastikan semua data terbaca jelas (tidak buram/gelap). Foto disimpan aman di Drive terbatas, hanya admin depot yang bisa lihat.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onChange}
            className="hidden"
          />

          {preview ? (
            <div className="space-y-2">
              <div className="relative rounded-xl overflow-hidden border border-line bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Preview KTP" className="w-full max-h-64 object-contain" />
                <button
                  onClick={reset}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white grid place-items-center"
                >
                  <X size={16} />
                </button>
              </div>
              <button
                onClick={submit}
                disabled={pending}
                className="w-full py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {pending ? "Mengirim..." : "Kirim ke Admin"}
              </button>
            </div>
          ) : (
            <button
              onClick={pickFile}
              className="w-full py-8 border-2 border-dashed border-line rounded-xl text-sm text-[color:var(--muted)] hover:border-brand hover:text-brand transition inline-flex flex-col items-center gap-2"
            >
              <Upload size={24} />
              <span>Ambil / Pilih Foto KTP</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
