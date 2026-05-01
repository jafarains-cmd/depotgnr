"use client";

import { useState, useTransition } from "react";
import { Plus, ShieldAlert, ShieldCheck, X, Pencil, Trash2 } from "lucide-react";
import {
  createStaff,
  updateUserRole,
  banUser,
  unbanUser,
  editUser,
  deleteUser,
} from "./actions";

type Row = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  phoneNumber: string | null;
  role: "admin" | "kasir" | "kurir" | "pelanggan";
  banned: boolean;
};

export function UsersClient({ users }: { users: Row[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [, startTransition] = useTransition();

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
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">Login</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3 text-xs">
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
                            `Hapus user ${u.name} (${u.email}) PERMANEN?\n\nData order/transaksi terkait akan jadi anonim (link ke user di-set NULL). Tindakan ini tidak bisa di-undo.`,
                          )
                        ) {
                          startTransition(async () => {
                            const r = await deleteUser(u.id);
                            if ("error" in r) alert(r.error);
                          });
                        }
                      }}
                      className="text-red-600 inline-flex items-center gap-1 hover:underline"
                    >
                      <Trash2 size={12} /> Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  return (
    <div>
      <label className="block text-xs font-medium text-[color:var(--muted)] mb-0.5">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full px-2.5 py-1.5 border border-line rounded-md bg-surface"
      />
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
