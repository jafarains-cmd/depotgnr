import { DateRangeFilter } from "@/components/DateRangeFilter";
import type { DateRangeKey } from "@/lib/date-range";

type User = { id: string; name: string };
type Pelanggan = { id: number; nama: string };

/**
 * Filter bar bersama untuk halaman laporan detail.
 * Render date range preset + form filter (q, by-user, by-pelanggan) yang
 * submit ulang URL params. Server-side filtering.
 */
export function FilterBar({
  basePath,
  rangeKey,
  rangeFrom,
  rangeTo,
  q,
  userId,
  userList,
  userLabel,
  pelangganId,
  pelangganList,
  showPelanggan,
  extraHidden,
}: {
  basePath: string;
  rangeKey: DateRangeKey;
  rangeFrom: Date | null;
  rangeTo: Date | null;
  q?: string;
  userId?: string;
  userList?: User[];
  userLabel?: string; // "Kasir" / "Kurir" / "Dibuat oleh"
  pelangganId?: string;
  pelangganList?: Pelanggan[];
  showPelanggan?: boolean;
  extraHidden?: Record<string, string | undefined>;
}) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-3 space-y-3 no-print">
      <DateRangeFilter
        active={rangeKey}
        customFrom={rangeFrom}
        customTo={rangeTo}
        basePath={basePath}
        preserveParams={["q", "userId", "pelangganId", ...Object.keys(extraHidden ?? {})]}
      />
      <form className="flex gap-2 flex-wrap items-center text-xs">
        {rangeKey && rangeKey !== "30d" && <input type="hidden" name="range" value={rangeKey} />}
        {extraHidden &&
          Object.entries(extraHidden).map(
            ([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />,
          )}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Cari nomor / nama / catatan..."
          className="flex-1 min-w-[160px] px-3 py-2 border border-line rounded-md"
        />
        {userList && userList.length > 0 && (
          <select
            name="userId"
            defaultValue={userId ?? ""}
            className="px-2 py-2 border border-line rounded-md"
          >
            <option value="">{userLabel ? `Semua ${userLabel}` : "Semua user"}</option>
            {userList.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
        {showPelanggan && pelangganList && (
          <select
            name="pelangganId"
            defaultValue={pelangganId ?? ""}
            className="px-2 py-2 border border-line rounded-md max-w-[180px]"
          >
            <option value="">Semua pelanggan</option>
            {pelangganList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          className="px-4 py-2 bg-brand-600 text-white rounded-md font-bold"
        >
          Terapkan
        </button>
        <a
          href={basePath}
          className="px-3 py-2 text-[color:var(--muted)] hover:text-ink"
        >
          Reset
        </a>
      </form>
    </div>
  );
}
