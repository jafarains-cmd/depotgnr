import Link from "next/link";
import { and, eq, desc, asc, gte, lte, like, or, sql, inArray } from "drizzle-orm";
import { ArrowLeft, MapPin, Phone, Coins, Package } from "lucide-react";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { bonusKurir } from "@/db/schema/bonus";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { parseRange } from "@/lib/date-range";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";
import { SortAutoSubmit } from "./SortAutoSubmit";

export const dynamic = "force-dynamic";

type StatusFilter = "all" | "selesai" | "diantar" | "diisi" | "dijemput" | "diproses" | "batal";
type BayarFilter = "all" | "lunas" | "belum" | "menunggu";

export default async function KurirRiwayatPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    q?: string;
    status?: string;
    bayar?: string;
    sort?: string;
    limit?: string;
    page?: string;
  }>;
}) {
  const session = await requireRole(["admin", "kasir", "kurir"]);
  const sp = await searchParams;
  const range = parseRange(sp);
  const q = (sp.q ?? "").trim();
  const status = (sp.status as StatusFilter) ?? "all";
  const bayar = (sp.bayar as BayarFilter) ?? "all";
  const sortKey = sp.sort ?? "tgl-desc";
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);

  const conds = [eq(orderHeader.kurirUserId, session.user.id)];
  if (range.from) conds.push(gte(orderHeader.createdAt, range.from));
  if (range.to) conds.push(lte(orderHeader.createdAt, range.to));
  if (q) {
    const pat = `%${q}%`;
    conds.push(
      or(
        like(orderHeader.nomorOrder, pat),
        like(pelangganTable.nama, pat),
        like(pelangganTable.telp, pat),
        like(orderHeader.alamatAntar, pat),
      )!,
    );
  }
  if (status !== "all") conds.push(eq(orderHeader.status, status));
  if (bayar !== "all") conds.push(eq(orderHeader.statusBayar, bayar));

  const whereClause = and(...conds);

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(whereClause);
  const total = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });

  const rows = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      status: orderHeader.status,
      statusBayar: orderHeader.statusBayar,
      alamatAntar: orderHeader.alamatAntar,
      totalEstimasi: orderHeader.totalEstimasi,
      createdAt: orderHeader.createdAt,
      diantarAt: orderHeader.diantarAt,
      pelangganNama: pelangganTable.nama,
      pelangganTelp: pelangganTable.telp,
      bonusTotal: bonusKurir.total,
      bonusStatus: bonusKurir.status,
      bonusJumlahGalon: bonusKurir.jumlahGalon,
    })
    .from(orderHeader)
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .leftJoin(bonusKurir, eq(bonusKurir.orderId, orderHeader.id))
    .where(whereClause)
    .orderBy(
      sortKey === "tgl-asc"
        ? asc(orderHeader.createdAt)
        : sortKey === "antar-desc"
          ? desc(orderHeader.diantarAt)
          : sortKey === "antar-asc"
            ? asc(orderHeader.diantarAt)
            : sortKey === "total-desc"
              ? desc(orderHeader.totalEstimasi)
              : sortKey === "total-asc"
                ? asc(orderHeader.totalEstimasi)
                : sortKey === "pelanggan-asc"
                  ? asc(pelangganTable.nama)
                  : desc(orderHeader.createdAt),
    )
    .limit(limit)
    .offset(offset);

  // Hitung jumlah galon per order (untuk display)
  const ids = rows.map((r) => r.id);
  const galonMap = new Map<number, number>();
  if (ids.length) {
    const itemRows = await db
      .select({ orderId: orderItem.orderId, qty: orderItem.qty })
      .from(orderItem)
      .where(inArray(orderItem.orderId, ids));
    for (const it of itemRows) {
      galonMap.set(it.orderId, (galonMap.get(it.orderId) ?? 0) + it.qty);
    }
  }

  // Summary card (untuk page filter aktif)
  const totalNilai = rows.reduce((s, r) => s + (r.totalEstimasi ?? 0), 0);
  const totalBonus = rows.reduce((s, r) => s + (r.bonusTotal ?? 0), 0);
  const totalGalon = rows.reduce((s, r) => s + (galonMap.get(r.id) ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/kurir"
          className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)] hover:text-brand"
        >
          <ArrowLeft size={14} /> Kembali
        </Link>
        <h1 className="text-base font-extrabold">Riwayat Pengantaran</h1>
      </div>

      {/* Filter bar */}
      <div className="bg-surface border border-line rounded-2xl p-3 space-y-3">
        <DateRangeFilter
          active={range.key}
          customFrom={range.from}
          customTo={range.to}
          basePath="/kurir/riwayat"
          preserveParams={["q", "status", "bayar", "sort", "limit"]}
        />
        <form className="flex gap-2 flex-wrap items-center">
          {range.key && <input type="hidden" name="range" value={range.key} />}
          {sp.from && <input type="hidden" name="from" value={sp.from} />}
          {sp.to && <input type="hidden" name="to" value={sp.to} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Cari pelanggan / nomor order / alamat..."
            className="flex-1 min-w-[180px] px-3 py-2 border border-line rounded-md text-sm"
          />
          <select
            name="status"
            defaultValue={status}
            className="px-2 py-2 border border-line rounded-md text-sm"
          >
            <option value="all">Semua status</option>
            <option value="selesai">Selesai</option>
            <option value="diantar">Diantar</option>
            <option value="diisi">Diisi</option>
            <option value="dijemput">Dijemput</option>
            <option value="diproses">Diproses</option>
            <option value="batal">Batal</option>
          </select>
          <select
            name="bayar"
            defaultValue={bayar}
            className="px-2 py-2 border border-line rounded-md text-sm"
          >
            <option value="all">Semua bayar</option>
            <option value="lunas">Lunas</option>
            <option value="belum">Belum</option>
            <option value="menunggu">Menunggu</option>
          </select>
          <SortAutoSubmit value={sortKey} />
          <button
            type="submit"
            className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-bold"
          >
            Cari
          </button>
          {(q || status !== "all" || bayar !== "all" || sortKey !== "tgl-desc") && (
            <a
              href="/kurir/riwayat"
              className="px-3 py-2 text-sm text-[color:var(--muted)] hover:text-ink"
            >
              Reset
            </a>
          )}
        </form>
      </div>

      {/* Summary card */}
      <div className="bg-brand-soft rounded-2xl p-3 grid grid-cols-3 gap-2">
        <Stat label="Pengantaran" value={String(total)} />
        <Stat label="Nilai Order" value={formatRupiah(totalNilai)} small />
        <Stat
          label="Bonus (page)"
          value={formatRupiah(totalBonus)}
          highlight="text-amber-700"
          small
        />
      </div>
      <div className="text-[10px] text-[color:var(--muted)] px-1">
        Total galon (halaman ini): <b>{totalGalon}</b> · Summary nilai/bonus mengikuti hasil
        filter pada halaman aktif.
      </div>

      {/* List */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[color:var(--muted)]">
          {total} hasil · halaman {page}/{totalPages}
        </div>
        <PageSizeSelect value={limit} />
      </div>

      {rows.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line p-10 text-center">
          <Package size={32} className="mx-auto text-[color:var(--muted)] mb-2" />
          <div className="text-sm font-bold">Tidak ada hasil</div>
          <div className="text-xs text-[color:var(--muted)] mt-1">
            Coba ubah filter atau range tanggal.
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/kurir/${r.id}`}
                className="block bg-surface border border-line rounded-2xl p-3 hover:border-brand transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{r.pelangganNama ?? "Pelanggan"}</span>
                      <StatusBadge status={r.status} />
                      <BayarBadge status={r.statusBayar} />
                    </div>
                    <div className="text-[11px] text-[color:var(--muted)] mt-0.5 flex flex-wrap gap-2">
                      <span className="font-mono">{r.nomorOrder}</span>
                      {r.pelangganTelp && (
                        <span className="inline-flex items-center gap-0.5">
                          <Phone size={10} /> {r.pelangganTelp}
                        </span>
                      )}
                      <span>
                        {(r.diantarAt ?? r.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {r.alamatAntar && (
                      <div className="text-[11px] text-[color:var(--muted)] mt-1 line-clamp-2 inline-flex items-start gap-1">
                        <MapPin size={11} className="flex-shrink-0 mt-0.5" />
                        <span>{r.alamatAntar}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-extrabold text-brand">
                      {formatRupiah(r.totalEstimasi)}
                    </div>
                    <div className="text-[10px] text-[color:var(--muted)]">
                      {galonMap.get(r.id) ?? 0} galon
                    </div>
                    {r.bonusTotal != null && (
                      <div className="mt-1 text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                        <Coins size={10} />
                        {formatRupiah(r.bonusTotal)}{" "}
                        {r.bonusStatus === "dibayar" ? "✓" : "·pending"}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  small,
}: {
  label: string;
  value: string;
  highlight?: string;
  small?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-[9px] font-bold tracking-widest text-[color:var(--muted)]">
        {label}
      </div>
      <div
        className={`${small ? "text-sm" : "text-lg"} font-extrabold ${highlight ?? "text-brand"} mt-0.5`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    diproses: "bg-amber-100 text-amber-800",
    dijemput: "bg-indigo-100 text-indigo-800",
    diisi: "bg-cyan-100 text-cyan-800",
    diantar: "bg-violet-100 text-violet-800",
    selesai: "bg-emerald-100 text-emerald-800",
    batal: "bg-rose-100 text-rose-800",
  };
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
        map[status] ?? "bg-[color:var(--surface2)] text-ink"
      }`}
    >
      {status}
    </span>
  );
}

function BayarBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    lunas: "bg-emerald-100 text-emerald-800",
    menunggu: "bg-amber-100 text-amber-800",
    belum: "bg-red-100 text-red-800",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${map[status] ?? ""}`}>
      bayar:{status}
    </span>
  );
}
