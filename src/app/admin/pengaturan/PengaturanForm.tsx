"use client";

import { useRef, useState, useTransition } from "react";

type Field = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "select";
  help?: string;
  options?: { value: string; label: string }[];
};

export function PengaturanForm({
  fields,
  values,
  action,
}: {
  fields: Field[];
  values: Record<string, string>;
  action: (fd: FormData) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    const fd = new FormData(formRef.current!);
    startTransition(async () => {
      try {
        await action(fd);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menyimpan");
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-surface rounded-xl border border-line p-5 space-y-4"
    >
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-sm font-medium text-ink mb-1">{f.label}</label>
          {f.type === "textarea" ? (
            <textarea
              name={f.key}
              defaultValue={values[f.key] ?? ""}
              rows={3}
              className="w-full px-3 py-2 border border-line rounded-md text-sm font-mono"
            />
          ) : f.type === "select" ? (
            <select
              name={f.key}
              defaultValue={values[f.key] ?? f.options?.[0]?.value ?? ""}
              className="w-full px-3 py-2 border border-line rounded-md text-sm bg-surface"
            >
              {f.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={f.key}
              defaultValue={values[f.key] ?? ""}
              className="w-full px-3 py-2 border border-line rounded-md text-sm"
            />
          )}
          {f.help && <p className="text-xs text-[color:var(--muted)] mt-1">{f.help}</p>}
        </div>
      ))}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-brand-600 text-white rounded-md disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
        {saved && <span className="text-emerald-600 text-sm">✓ Tersimpan</span>}
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>
    </form>
  );
}
