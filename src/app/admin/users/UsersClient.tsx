"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, ShieldAlert, ShieldCheck, X, Pencil, Trash2, KeyRound, Copy, Check, UserCheck, UserX } from "lucide-react";
import {
  createStaff,
  updateUserRole,
  banUser,
  unbanUser,
  editUser,
  deleteUser,
  generateResetLink,
} from "./actions";
import { PasswordInput } from "@/components/PasswordInput";
import { useToast } from "@/components/Toast";

type Row = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  phoneNumber: string | null;
  role: "admin" | "kasir" | "kurir" | "pelanggan";
  banned: boolean;
  lastLogin: string | null;
  sessionCount: number;
  pelanggan: { id: number; nama: string } | null;
};

function formatLastLogin(iso: string | null): { label: string; color: string } {
  if (!iso) return { label: "Belum pernah", color: "text-[color:var(--muted)]" };
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  let label: string;
  let color: string;
  if (diffMin < 5) {
    label = "Aktif sekarang";
    color = "text-emerald-700";
  } else if (diffMin < 60) {
    label = `${diffMin} menit lalu`;
    color = "text-emerald-700";
  } else if (diffHour < 24) {
    label = `${diffHour} jam lalu`;
    color = "text-emerald-700";
  } else if (diffDay < 7) {
    label = `${diffDay} hari lalu`;
    color = "text-amber-700";
  } else if (diffDay < 30) {
    label = `${diffDay} hari lalu`;
    color = "text-amber-700";
  } else if (diffDay < 90) {
    label = `${diffDay} hari lalu`;
    color = "text-rose-700";
  } else {
    label = `> 90 hari (tidak aktif)`;
    color = "text-rose-700";
  }
  return { label, color };
}

export function UsersClient({ users }: { users: Row[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="px-3 py-2 bg-brand text-white rounded-md text-sm flex items-center gap-1"
        >
          <Plus size={16} /> Tambah Admin/Kasir/Kurir
        </button>
      </div>

      {creating && (
        <div className="bg-surface rounded-xl border border-line p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Tambah Staff</h2>
            <button onClick={() => setCreating(false)} className="text-[color:var(--muted)]">
              <X size={18} />
            </button>
          </div>
          <CreateStaffForm onDone={() => setCreating(false)} />
        </div>
      )}

      {editing && (
        <EditUserModal user={editing} onClose={() => setEditing(null)} />
      )}

      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3 hidden sm:table-cell">Login</th>
              <th className="p-3">Role</th>
              <th className="p-3 hidden md:table-cell">Aktivitas</th>
              <th className="p-3 hidden lg:table-cell">Pelanggan</th>
              <th className="p-3 hidden sm:table-cell">Status</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="p-3 font-medium">
                  <div>{u.name}</div>
                  {/* Mobile: tampilkan email/status di bawah nama */}
                  <div className="sm:hidden text-[10px] text-[color:var(--muted)] mt-0.5 space-y-0.5">
                    <div>{u.email}</div>
                    {u.banned && <div className="text-red-600 font-bold">DITANGGUHKAN</div>}
                  </div>
                </td>
                <td className="p-3 text-xs hidden sm:table-cell">
                  <div>{u.email}</div>
                  {u.username && <div className="text-[color:var(--muted)]">@{u.username}</div>}
                  {u.phoneNumber && <div className="text-[color:var(--muted)]">{u.phoneNumber}</div>}
                </td>
                <td className="p-3">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      startTransition(() =>
                        updateUserRole(u.id, e.target.value as Row["role"]),
                      )
                    }
                    className="px-2 py-1 border border-line rounded-md text-xs bg-surface"
                  >
                    <option value="pelanggan">pelanggan</option>
                    <option value="kurir">kurir</option>
                    <option value="kasir">kasir</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="p-3 hidden md:table-cell">
                  <UserActivity row={u} />
                </td>
                <td className="p-3 hidden lg:table-cell">
                  {u.pelanggan ? (
                    <Link
                      href={`/data-pelanggan/${u.pelanggan.id}`}
                      className="text-xs inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                      title="Buka detail pelanggan"
                    >
                      <UserCheck size={11} />
                      <span className="max-w-[140px] truncate">{u.pelanggan.nama}</span>
                    </Link>
                  ) : (
                    <span className="text-xs inline-flex items-center gap-1 text-[color:var(--muted)]">
                      <UserX size={11} /> Belum tertaut
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {u.banned ? (
                    <span className="text-red-600 text-xs">Ditangguhkan</span>
                  ) : (
                    <span className="text-emerald-600 text-xs">Aktif</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-3 text-xs">
                    <button
                      onClick={() => setEditing(u)}
                      className="text-brand inline-flex items-center gap-1 hover:underline"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <ResetLinkButton userId={u.id} userName={u.name} />
                    {u.banned ? (
                      <button
                        onClick={() => startTransition(() => unbanUser(u.id))}
                        className="text-emerald-700 inline-flex items-center gap-1 hover:underline"
                      >
                        <ShieldCheck size={12} /> Aktifkan
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const reason = prompt("Alasan ban?") ?? "";
                          if (reason) startTransition(() => banUser(u.id, reason));
                        }}
                        className="text-amber-700 inline-flex items-center gap-1 hover:underline"
                      >
                        <ShieldAlert size={12} /> Ban
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Nonaktifkan user ${u.name} (${u.email})?\n\nUser tidak bisa login lagi, semua sesi aktif dihapus. Data order/transaksi tetap utuh dengan nama asli. Bisa diaktifkan kembali kapan saja.`,
                          )
                        ) {
                          startTransition(async () => {
                            const r = await deleteUser(u.id, "soft");
                            if ("error" in r) toast.error(r.error);
                            else toast.success(`User ${u.name} dinonaktifkan`);
                          });
                        }
                      }}
                      className="text-amber-700 inline-flex items-center gap-1 hover:underline"
                      title="Nonaktifkan (soft delete) — direkomendasikan"
                    >
                      <Trash2 size={12} /> Nonaktifkan
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `⚠ HAPUS PERMANEN user ${u.name} (${u.email})?\n\nData order/transaksi terkait akan jadi anonim (nama '—'). Tidak bisa di-undo.\n\nDirekomendasikan pakai "Nonaktifkan" sebagai gantinya.`,
                          )
                        ) {
                          startTransition(async () => {
                            const r = await deleteUser(u.id, "hard");
                            if ("error" in r) toast.error(r.error);
                            else toast.success(`User ${u.name} dihapus permanen`);
                          });
                        }
                      }}
                      className="text-red-600 inline-flex items-center gap-1 hover:underline text-[10px]"
                      title="Hapus permanen dari database"
                    >
                      <Trash2 size={10} /> Hapus×
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose }: { user: Row; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nama, setNama] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber ?? "");

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl border border-line p-5 max-w-md w-full">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-extrabold text-lg">Edit User</h2>
          <button onClick={onClose} className="text-[color:var(--muted)]">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const r = await editUser(user.id, {
                nama,
                email,
                username: username || null,
                phoneNumber: phoneNumber || null,
              });
              if ("error" in r) setError(r.error);
              else onClose();
            });
          }}
          className="space-y-3 text-sm"
        >
          <Field label="Nama" value={nama} onChange={setNama} required />
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <Field
            label="Username (opsional)"
            value={username}
            onChange={setUsername}
            placeholder="lowercase, 3-30 char"
          />
          <Field
            label="Nomor HP / WA (opsional)"
            value={phoneNumber}
            onChange={setPhoneNumber}
            placeholder="08xxxxxxxxxx"
          />

          <p className="text-[11px] text-[color:var(--muted)]">
            Password tidak diubah di sini. User bisa ganti password sendiri di /akun, atau buat
            ulang user.
          </p>

          {error && (
            <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-[color:var(--muted)]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 bg-brand text-white rounded-md text-sm font-bold disabled:opacity-50"
            >
              {pending ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateStaffForm({ onDone }: { onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          try {
            await createStaff(fd);
            onDone();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Gagal");
          }
        });
      }}
      className="grid sm:grid-cols-2 gap-3 text-sm"
    >
      <FormField label="Nama" name="nama" required />
      <div>
        <label className="block text-xs font-medium text-[color:var(--muted)] mb-0.5">Role</label>
        <select
          name="role"
          defaultValue="kasir"
          className="w-full px-2.5 py-1.5 border border-line rounded-md bg-surface"
        >
          <option value="kasir">Kasir</option>
          <option value="kurir">Kurir</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <FormField label="Email (opsional)" name="email" type="email" />
      <FormField label="Username (opsional)" name="username" />
      <FormField label="Password" name="password" type="password" required />
      <div className="sm:col-span-2 flex justify-end gap-2">
        {error && <span className="text-red-600 text-xs self-center mr-auto">{error}</span>}
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-brand text-white rounded-md disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Buat"}
        </button>
      </div>
    </form>
  );
}

function FormField({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  const cls = "w-full px-2.5 py-1.5 border border-line rounded-md bg-surface";
  return (
    <div>
      <label className="block text-xs font-medium text-[color:var(--muted)] mb-0.5">{label}</label>
      {type === "password" ? (
        <PasswordInput name={name} required={required} className={cls} />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          className={cls}
        />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[color:var(--muted)] mb-0.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-line rounded-md bg-surface text-sm"
      />
    </div>
  );
}

function ResetLinkButton({ userId, userName }: { userId: string; userName: string }) {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  function handleClick() {
    if (
      !confirm(
        `Generate link reset password untuk ${userName}?\n\nLink berlaku 24 jam. Pastikan Anda kasih link ke user yang benar.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await generateResetLink(userId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setLink(r.url);
      setExpiresAt(r.expiresAt);
    });
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (link) {
    return (
      <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl max-w-lg w-full p-4 space-y-3">
          <h3 className="font-bold inline-flex items-center gap-1.5">
            <KeyRound size={14} /> Reset Link untuk {userName}
          </h3>
          <p className="text-xs text-[color:var(--muted)]">
            Salin link ini & berikan ke user via channel apapun (in-person, WA, telpon).
            Berlaku sampai{" "}
            <strong>
              {expiresAt
                ? new Date(expiresAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—"}
            </strong>
            .
          </p>
          <div className="bg-[color:var(--surface2)] border border-line rounded-md p-2 break-all text-xs font-mono">
            {link}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setLink(null);
                setExpiresAt(null);
              }}
              className="px-3 py-1.5 border border-line rounded-md text-xs"
            >
              Tutup
            </button>
            <button
              onClick={copyLink}
              className="px-3 py-1.5 bg-brand-600 text-white rounded-md text-xs font-bold inline-flex items-center gap-1"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Tersalin" : "Salin Link"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-purple-600 inline-flex items-center gap-1 hover:underline disabled:opacity-50"
      title="Generate link reset password (24 jam)"
    >
      <KeyRound size={12} /> Reset
    </button>
  );
}

function UserActivity({ row }: { row: Row }) {
  const { label, color } = formatLastLogin(row.lastLogin);
  return (
    <div className="text-xs space-y-0.5">
      <div className={`font-bold ${color}`}>{label}</div>
      <div className="text-[10px] text-[color:var(--muted)]">
        {row.sessionCount} sesi login
      </div>
    </div>
  );
}
