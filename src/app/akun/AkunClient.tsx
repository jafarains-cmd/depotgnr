"use client";

import { useState, useTransition } from "react";
import { KeyRound, AtSign, Check, User, MapPin, Phone, Mail } from "lucide-react";
import {
  setUsernameAction,
  setPasswordAction,
  setNamaAction,
  setAlamatAction,
  setNomorWAAction,
  setEmailAction,
} from "./actions";
import { PasswordInput } from "@/components/PasswordInput";

export function AkunClient({
  currentNama,
  currentAlamat,
  currentNomor,
  currentEmail,
  currentUsername,
  hasPassword,
  showAlamat,
}: {
  currentNama: string;
  currentAlamat: string;
  currentNomor: string;
  currentEmail: string;
  currentUsername: string | null;
  hasPassword: boolean;
  showAlamat: boolean;
}) {
  return (
    <div className="space-y-4">
      <NamaForm currentNama={currentNama} />
      {showAlamat && <AlamatForm currentAlamat={currentAlamat} />}
      <NomorWAForm currentNomor={currentNomor} />
      <EmailForm currentEmail={currentEmail} />
      <UsernameForm currentUsername={currentUsername} />
      <PasswordForm hasPassword={hasPassword} />
    </div>
  );
}

function EmailForm({ currentEmail }: { currentEmail: string }) {
  // Hide auto-generated phone-based emails from initial state
  const isPhoneEmail = currentEmail.endsWith("@phone.depot.local");
  const [email, setEmail] = useState(isPhoneEmail ? "" : currentEmail);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold inline-flex items-center gap-1.5">
        <Mail size={16} /> Email
      </h2>
      <p className="text-sm text-[color:var(--muted)]">
        Dipakai untuk login & reset password lewat email kalau lupa.
        {isPhoneEmail && (
          <span className="text-amber-600">
            {" "}
            Akun Anda belum punya email — silakan isi.
          </span>
        )}
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="contoh@email.com"
        className="w-full px-3 py-2 border border-line rounded-md text-sm"
      />
      <div className="flex items-center gap-3">
        <button
          disabled={pending || !email.trim() || email === currentEmail}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const r = await setEmailAction(email);
              if ("error" in r) setMsg({ ok: false, text: r.error });
              else setMsg({ ok: true, text: "Email tersimpan" });
            });
          }}
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Check size={14} /> Simpan
        </button>
        {msg && (
          <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-rose-600"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}

function NomorWAForm({ currentNomor }: { currentNomor: string }) {
  const [nomor, setNomor] = useState(currentNomor);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold inline-flex items-center gap-1.5">
        <Phone size={16} /> Nomor WhatsApp
      </h2>
      <p className="text-sm text-[color:var(--muted)]">
        Untuk menerima notifikasi pesanan & promo via WA. Contoh: 08123456789.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          startTransition(async () => {
            const res = await setNomorWAAction(nomor);
            if ("error" in res) setMsg({ ok: false, text: res.error });
            else {
              setNomor(res.normalized);
              setMsg({ ok: true, text: "Nomor tersimpan" });
            }
          });
        }}
        className="space-y-2"
      >
        <input
          type="tel"
          inputMode="numeric"
          value={nomor}
          onChange={(e) => setNomor(e.target.value)}
          placeholder="08123456789"
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
          maxLength={20}
        />
        {msg && (
          <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
            {msg.ok && <Check className="inline" size={12} />} {msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || nomor.trim() === currentNomor}
          className="px-4 py-2 bg-brand text-white rounded-md text-sm disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Simpan Nomor"}
        </button>
      </form>
    </div>
  );
}

function AlamatForm({ currentAlamat }: { currentAlamat: string }) {
  const [alamat, setAlamat] = useState(currentAlamat);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold inline-flex items-center gap-1.5">
        <MapPin size={16} /> Alamat Pengantaran
      </h2>
      <p className="text-sm text-[color:var(--muted)]">
        Akan terisi otomatis saat order baru. Anda bisa ubah alamat per pesanan.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          startTransition(async () => {
            const res = await setAlamatAction(alamat);
            if ("error" in res) setMsg({ ok: false, text: res.error });
            else setMsg({ ok: true, text: "Alamat tersimpan" });
          });
        }}
        className="space-y-2"
      >
        <textarea
          value={alamat}
          onChange={(e) => setAlamat(e.target.value)}
          placeholder="Jl. Contoh No.123, RT/RW, Kelurahan, Kecamatan"
          rows={3}
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
          maxLength={500}
        />
        {msg && (
          <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
            {msg.ok && <Check className="inline" size={12} />} {msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || alamat.trim() === currentAlamat}
          className="px-4 py-2 bg-brand text-white rounded-md text-sm disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Simpan Alamat"}
        </button>
      </form>
    </div>
  );
}

function NamaForm({ currentNama }: { currentNama: string }) {
  const [nama, setNama] = useState(currentNama);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold inline-flex items-center gap-1.5">
        <User size={16} /> Nama
      </h2>
      <p className="text-sm text-[color:var(--muted)]">
        Nama yang ditampilkan di pesanan, struk, dan notifikasi.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          startTransition(async () => {
            const res = await setNamaAction(nama);
            if ("error" in res) setMsg({ ok: false, text: res.error });
            else setMsg({ ok: true, text: "Nama tersimpan" });
          });
        }}
        className="space-y-2"
      >
        <input
          type="text"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          placeholder="Nama lengkap Anda"
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
          required
          minLength={2}
          maxLength={60}
        />
        {msg && (
          <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
            {msg.ok && <Check className="inline" size={12} />} {msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || nama.trim() === currentNama}
          className="px-4 py-2 bg-brand text-white rounded-md text-sm disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Simpan Nama"}
        </button>
      </form>
    </div>
  );
}

function UsernameForm({ currentUsername }: { currentUsername: string | null }) {
  const [username, setUsername] = useState(currentUsername ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold inline-flex items-center gap-1.5">
        <AtSign size={16} /> Username
      </h2>
      <p className="text-sm text-[color:var(--muted)]">
        {currentUsername
          ? "Ganti username Anda. Bisa dipakai untuk login."
          : "Buat username untuk login lebih cepat (selain email/nomor WA)."}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          startTransition(async () => {
            const res = await setUsernameAction(username);
            if ("error" in res) setMsg({ ok: false, text: res.error });
            else setMsg({ ok: true, text: "Username tersimpan" });
          });
        }}
        className="space-y-2"
      >
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username Anda"
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
          required
          minLength={3}
          maxLength={30}
        />
        {msg && (
          <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
            {msg.ok && <Check className="inline" size={12} />} {msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Simpan Username"}
        </button>
      </form>
    </div>
  );
}

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold inline-flex items-center gap-1.5">
        <KeyRound size={16} /> {hasPassword ? "Ganti Password" : "Buat Password"}
      </h2>
      <p className="text-sm text-[color:var(--muted)]">
        {hasPassword
          ? "Masukkan password lama untuk mengubah password Anda."
          : "Buat password agar bisa login pakai email/username (selain OTP WhatsApp)."}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          if (newPassword !== confirm) {
            setMsg({ ok: false, text: "Konfirmasi password tidak cocok" });
            return;
          }
          startTransition(async () => {
            const res = await setPasswordAction(
              newPassword,
              hasPassword ? currentPassword : undefined,
            );
            if ("error" in res) {
              setMsg({ ok: false, text: res.error });
            } else {
              setMsg({ ok: true, text: "Password tersimpan" });
              setCurrentPassword("");
              setNewPassword("");
              setConfirm("");
            }
          });
        }}
        className="space-y-2"
      >
        {hasPassword && (
          <PasswordInput
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Password lama"
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
            required
            autoComplete="current-password"
          />
        )}
        <PasswordInput
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={hasPassword ? "Password baru (min 6)" : "Password (min 6)"}
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
          required
          minLength={6}
          autoComplete="new-password"
        />
        <PasswordInput
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Ulangi password"
          className="w-full px-3 py-2 border border-line rounded-md text-sm"
          required
          minLength={6}
          autoComplete="new-password"
        />
        {msg && (
          <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
            {msg.ok && <Check className="inline" size={12} />} {msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : hasPassword ? "Ganti Password" : "Buat Password"}
        </button>
      </form>
    </div>
  );
}
