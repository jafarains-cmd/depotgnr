"use client";

import { useState, useTransition } from "react";
import { Plus, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { createStaff, updateUserRole, banUser, unbanUser } from "./actions";

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
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="px-3 py-2 bg-brand-600 text-white rounded-md text-sm flex items-center gap-1"
        >
          <Plus size={16} /> Tambah Admin/Kasir
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

      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">Login</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
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
                    className="px-2 py-1 border border-line rounded-md text-xs"
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
                <td className="p-3 text-right">
                  {u.banned ? (
                    <button
                      onClick={() => startTransition(() => unbanUser(u.id))}
                      className="text-xs text-emerald-700 inline-flex items-center gap-1"
                    >
                      <ShieldCheck size={12} /> Aktifkan
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const reason = prompt("Alasan ban?") ?? "";
                        if (reason) startTransition(() => banUser(u.id, reason));
                      }}
                      className="text-xs text-red-600 inline-flex items-center gap-1"
                    >
                      <ShieldAlert size={12} /> Ban
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <Field label="Nama" name="nama" required />
      <div>
        <label className="block text-xs font-medium text-[color:var(--muted)] mb-0.5">Role</label>
        <select name="role" defaultValue="kasir" className="w-full px-2.5 py-1.5 border border-line rounded-md">
          <option value="kasir">Kasir</option>
          <option value="kurir">Kurir</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <Field label="Email (opsional)" name="email" type="email" />
      <Field label="Username (opsional)" name="username" />
      <Field label="Password" name="password" type="password" required />
      <div className="sm:col-span-2 flex justify-end gap-2">
        {error && <span className="text-red-600 text-xs self-center mr-auto">{error}</span>}
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-brand-600 text-white rounded-md disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Buat"}
        </button>
      </div>
    </form>
  );
}

function Field({
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
        className="w-full px-2.5 py-1.5 border border-line rounded-md"
      />
    </div>
  );
}
