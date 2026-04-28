"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

type Mode = "email" | "username" | "phone";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Memuat...</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const [mode, setMode] = useState<Mode>("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "email") {
        const { error } = await authClient.signIn.email({
          email: identifier,
          password,
          callbackURL: next,
        });
        if (error) throw new Error(error.message ?? "Gagal masuk");
        router.push(next);
        router.refresh();
      } else if (mode === "username") {
        const { error } = await authClient.signIn.username({
          username: identifier,
          password,
        });
        if (error) throw new Error(error.message ?? "Gagal masuk");
        router.push(next);
        router.refresh();
      } else {
        if (!otpSent) {
          const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber: identifier });
          if (error) throw new Error(error.message ?? "Gagal kirim OTP");
          setOtpSent(true);
        } else {
          const { error } = await authClient.phoneNumber.verify({
            phoneNumber: identifier,
            code: otp,
          });
          if (error) throw new Error(error.message ?? "OTP salah / kedaluwarsa");
          router.push(next);
          router.refresh();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Masuk</h1>
        <p className="text-sm text-slate-500">Selamat datang kembali di Depot Air.</p>
      </div>

      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg text-sm">
        {(["email", "username", "phone"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setOtpSent(false);
              setError(null);
            }}
            className={`py-1.5 rounded-md transition ${
              mode === m ? "bg-white shadow-sm font-medium" : "text-slate-600"
            }`}
          >
            {m === "email" ? "Email" : m === "username" ? "Username" : "Nomor WA"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-sm font-medium block mb-1">
            {mode === "email" ? "Email" : mode === "username" ? "Username" : "Nomor WhatsApp"}
          </label>
          <input
            type={mode === "email" ? "email" : "text"}
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={mode === "phone" ? "08xxxxxxxxxx" : ""}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {mode !== "phone" && (
          <div>
            <label className="text-sm font-medium block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}

        {mode === "phone" && otpSent && (
          <div>
            <label className="text-sm font-medium block mb-1">Kode OTP</label>
            <input
              type="text"
              inputMode="numeric"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md tracking-widest text-center"
            />
            <button
              type="button"
              onClick={() => setOtpSent(false)}
              className="text-xs text-slate-500 mt-1 hover:underline"
            >
              Ganti nomor
            </button>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-brand-600 text-white font-medium rounded-md hover:bg-brand-700 disabled:opacity-50"
        >
          {loading
            ? "Memproses..."
            : mode === "phone" && !otpSent
              ? "Kirim OTP"
              : "Masuk"}
        </button>
      </form>

      <p className="text-sm text-center text-slate-600">
        Belum punya akun?{" "}
        <Link href="/register" className="text-brand-600 hover:underline">
          Daftar
        </Link>
      </p>
    </div>
  );
}
