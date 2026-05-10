"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Mail, ShieldAlert, Loader2 } from "lucide-react";
import { requestPasswordReset } from "./actions";

export default function LupaPasswordPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    | {
        ok: true;
        userId: string;
        sentWa: boolean;
        sentEmail: boolean;
        nomorHint?: string;
        emailHint?: string;
        waError?: string;
        emailError?: string;
      }
    | { needsAdmin: true; userName: string }
    | null
  >(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    startTransition(async () => {
      const r = await requestPasswordReset(identifier);
      if ("ok" in r && r.ok) {
        setResult(r);
      } else if ("needsAdmin" in r && r.needsAdmin) {
        setResult({ needsAdmin: true, userName: r.userName });
      } else if ("error" in r) {
        setError(r.error);
      }
    });
  }

  function gotoWaOtp(userId: string, hint?: string) {
    router.push(
      `/reset-password?method=wa&userId=${encodeURIComponent(userId)}&hint=${encodeURIComponent(hint ?? "")}`,
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/login"
        className="text-sm text-[color:var(--muted)] hover:text-brand inline-flex items-center gap-1"
      >
        <ArrowLeft size={14} /> Kembali ke Login
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Lupa Password</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Masukkan email, username, atau nomor WhatsApp. Kami akan kirim cara reset
          password.
        </p>
      </div>

      {result && "ok" in result && result.ok && (
        <div className="space-y-2">
          {result.sentWa && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="font-bold text-emerald-900 inline-flex items-center gap-2">
                <MessageCircle size={16} /> OTP Terkirim ke WhatsApp
              </div>
              <p className="text-xs text-emerald-800 mt-1">
                OTP 6 digit dikirim ke <strong>{result.nomorHint}</strong>. Berlaku 5
                menit.
              </p>
              <button
                onClick={() => gotoWaOtp(result.userId, result.nomorHint)}
                className="mt-2 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-bold inline-flex items-center gap-1"
              >
                Input OTP →
              </button>
            </div>
          )}
          {result.sentEmail && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="font-bold text-blue-900 inline-flex items-center gap-2">
                <Mail size={16} /> Link Reset Terkirim ke Email
              </div>
              <p className="text-xs text-blue-800 mt-1">
                Link reset password dikirim ke <strong>{result.emailHint}</strong>.
                Cek inbox (atau folder Spam) — link berlaku 1 jam.
              </p>
            </div>
          )}
          {(result.waError || result.emailError) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
              {result.waError && <div>⚠ Gagal kirim WA: {result.waError}</div>}
              {result.emailError && <div>⚠ Gagal kirim email: {result.emailError}</div>}
            </div>
          )}
          {result.sentWa && result.sentEmail && (
            <div className="text-xs text-[color:var(--muted)] text-center">
              Pakai salah satu — yang sampai duluan, kedua-duanya valid.
            </div>
          )}
        </div>
      )}

      {result && "needsAdmin" in result && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="font-bold text-amber-900 inline-flex items-center gap-2">
            <ShieldAlert size={16} /> Tidak Bisa Auto-Reset
          </div>
          <p className="text-xs text-amber-800 mt-1">
            Akun <strong>{result.userName}</strong> belum punya nomor WhatsApp atau
            email yang valid. Silakan hubungi admin Depot — admin akan generate link
            reset yang aman untuk Anda.
          </p>
          <p className="text-xs text-amber-800 mt-2">
            Sampaikan ke admin: nama lengkap atau username Anda untuk verifikasi
            identitas.
          </p>
        </div>
      )}

      {!result && (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">
              Email / Username / Nomor WhatsApp
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="contoh: budi@email.com atau 08123456789"
              className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
              required
              autoFocus
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending || !identifier.trim()}
            className="w-full py-2.5 bg-brand-600 text-white font-medium rounded-md hover:bg-brand-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {pending && <Loader2 className="animate-spin" size={14} />}
            {pending ? "Memproses..." : "Kirim Cara Reset"}
          </button>
        </form>
      )}

      <div className="text-[11px] text-[color:var(--muted)] bg-[color:var(--surface2)] rounded-md p-3 space-y-1">
        <div className="font-bold">Bagaimana caranya?</div>
        <p>
          1. Kalau akun ada nomor WA → kami kirim OTP ke WhatsApp Anda.
          <br />
          2. Kalau tidak ada WA tapi ada email → kami kirim link reset ke email.
          <br />
          3. Kalau dua-duanya tidak ada → silakan hubungi admin untuk generate link
          reset manual.
        </p>
      </div>
    </div>
  );
}
