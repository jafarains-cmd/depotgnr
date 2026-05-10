"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { verifyAndResetPassword } from "../lupa-password/actions";
import { PasswordInput } from "@/components/PasswordInput";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[color:var(--muted)]">Memuat...</div>}>
      <ResetInner />
    </Suspense>
  );
}

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const method = params.get("method"); // "wa" | null
  const token = params.get("token") ?? "";
  const userId = params.get("userId") ?? "";
  const hint = params.get("hint") ?? "";

  const [pending, startTransition] = useTransition();
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isWaFlow = method === "wa";
  const tokenToVerify = isWaFlow ? otp : token;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak cocok");
      return;
    }
    if (isWaFlow && otp.length !== 6) {
      setError("OTP harus 6 digit");
      return;
    }
    startTransition(async () => {
      const r = await verifyAndResetPassword({
        token: tokenToVerify,
        userId: isWaFlow ? userId : undefined,
        newPassword: password,
      });
      if ("error" in r) {
        setError(r.error);
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 2000);
      }
    });
  }

  if (success) {
    return (
      <div className="space-y-4 text-center py-8">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 grid place-items-center">
          <CheckCircle size={32} className="text-emerald-600" />
        </div>
        <h1 className="text-xl font-bold">Password Berhasil Direset</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Anda akan dialihkan ke halaman login...
        </p>
      </div>
    );
  }

  if (!isWaFlow && !token) {
    return (
      <div className="space-y-4">
        <Link
          href="/lupa-password"
          className="text-sm text-[color:var(--muted)] hover:text-brand inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Lupa Password
        </Link>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-800">
          Token tidak ditemukan di URL. Pastikan Anda klik link reset dari email/WA
          dengan benar, atau request ulang.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold inline-flex items-center gap-2">
          <KeyRound size={22} /> Reset Password
        </h1>
        <p className="text-sm text-[color:var(--muted)] mt-1">
          {isWaFlow
            ? `Masukkan OTP 6 digit yang dikirim ke WA ${hint}.`
            : "Set password baru untuk akun Anda."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {isWaFlow && (
          <div>
            <label className="text-sm font-medium block mb-1">Kode OTP</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="w-full px-3 py-2 border border-line rounded-md text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-500"
              required
              autoFocus
            />
            <p className="text-[11px] text-[color:var(--muted)] mt-1">
              OTP berlaku 5 menit. Cek WhatsApp Anda.
            </p>
          </div>
        )}

        <div>
          <label className="text-sm font-medium block mb-1">Password Baru</label>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 karakter"
            minLength={8}
            required
            className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Ulangi Password</label>
          <PasswordInput
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Tulis ulang password baru"
            minLength={8}
            required
            className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || !password || !confirm || (isWaFlow && otp.length !== 6)}
          className="w-full py-2.5 bg-brand-600 text-white font-medium rounded-md hover:bg-brand-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {pending && <Loader2 className="animate-spin" size={14} />}
          {pending ? "Menyimpan..." : "Reset Password"}
        </button>
      </form>

      <div className="text-center">
        <Link
          href="/lupa-password"
          className="text-xs text-[color:var(--muted)] hover:text-brand"
        >
          ← Kirim ulang OTP / link reset
        </Link>
      </div>
    </div>
  );
}
