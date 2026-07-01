import {
  sql,
  gte,
  lte,
  and,
  eq,
  desc,
  isNull,
  like,
  or,
  inArray,
} from "drizzle-orm";
import { db } from "@/db";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { orderHeader, orderItem } from "@/db/schema/order";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { produk } from "@/db/schema/produk";
import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { parseRange } from "@/lib/date-range";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { LaporanNav } from "../LaporanNav";
import { FilterBar } from "../FilterBar";
import { ExportActions } from "../ExportActions";
import { PrintStyles, PrintHeader } from "../PrintStyles";
import { AutoSubmitSelect } from "../AutoSubmitSelect";
import { LaporanClickProvider, LaporanRow } from "../LaporanClickable";

export const dynamic = "force-dynamic";

type UnifiedRow = {
  kind: "transaksi" | "order";
  id: number;
  nomor: string;
  createdAt: Date;
  total: number;
  statusBayar: string;
  statusOrder: string | null;
  metodeBayar: string | null;
  sumber: string;
  kasirKurirNama: string | null;
  pelangganNama: string | null;
  qtyGalon: number;
  voided: boolean;
};

export default async function SemuaAktivitasPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    q?: string;
    userId?: string;
    pelangganId?: string;
    status?: string;
    limit?: string;
    page?: string;
  }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const range = parseRange(sp);
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const q = (sp.q ?? "").trim();
  const userId = sp.userId?.trim() || undefined;
  const pelangganId = sp.pelangganId?.trim() || undefined;
  const statusFilter = sp.status?.trim() || "all";

  // ====== Query Transaksi POS ======
  const trxConds = [];
  if (range.from) trxConds.push(gte(transaksi.createdAt, range.from));
  if (range.to) trxConds.push(lte(transaksi.createdAt, range.to));
  if (statusFilter === "batal") trxConds.push(sql`${transaksi.voidedAt} IS NOT NULL`);
  else if (statusFilter !== "all") trxConds.push(isNull(transaksi.voidedAt));
  else trxConds.push(isNull(transaksi.voidedAt));
  if (userId) trxConds.push(eq(transaksi.kasirUserId, userId));
  if (pelangganId) trxConds.push(eq(transaksi.pelangganId, Number(pelangganId)));
  if (q) {
    const pat = `%${q}%`;
    trxConds.push(
      or(
        like(transaksi.nomorNota, pat),
        like(pelangganTable.nama, pat),
      )!,
    );
  }
  // Skip transaksi yang punya refOrderId (anti-duplikasi — order sudah tampil)
  trxConds.push(isNull(transaksi.refOrderId));

  const trxRows = await db
    .select({
      id: transaksi.id,
      nomorNota: transaksi.nomorNota,
      createdAt: transaksi.createdAt,
      total: transaksi.total,
      metodeBayar: transaksi.metodeBayar,
      voidedAt: transaksi.voidedAt,
      kasirNama: userTable.name,
      pelangganNama: pelangganTable.nama,
    })
    .from(transaksi)
    .leftJoin(userTable, eq(transaksi.kasirUserId, userTable.id))
    .leftJoin(pelangganTable, eq(transaksi.pelangganId, pelangganTable.id))
    .where(and(...trxConds))
    .orderBy(desc(transaksi.createdAt))
    .limit(500);

  // Galon per transaksi
  const trxIds = trxRows.map((t) => t.id);
  const trxGalonMap = new Map<number, number>();
  if (trxIds.length) {
    const r = await db
      .select({ transaksiId: transaksiItem.transaksiId, qty: transaksiItem.qty })
      .from(transaksiItem)
      .where(inArray(transaksiItem.transaksiId, trxIds));
    for (const it of r) trxGalonMap.set(it.transaksiId, (trxGalonMap.get(it.transaksiId) ?? 0) + it.qty);
  }

  // ====== Query Order ======
  const ordConds = [];
  if (range.from) ordConds.push(gte(orderHeader.createdAt, range.from));
  if (range.to) ordConds.push(lte(orderHeader.createdAt, range.to));
  if (statusFilter === "lunas") ordConds.push(eq(orderHeader.statusBayar, "lunas"));
  else if (statusFilter === "piutang") {
    ordConds.push(eq(orderHeader.status, "selesai"));
    ordConds.push(eq(orderHeader.statusBayar, "belum"));
  } else if (statusFilter === "batal") ordConds.push(eq(orderHeader.status, "batal"));
  else if (statusFilter === "aktif") {
    ordConds.push(sql`${orderHeader.status} NOT IN ('selesai', 'batal')`);
  }
  if (userId) ordConds.push(eq(orderHeader.kurirUserId, userId));
  if (pelangganId) ordConds.push(eq(orderHeader.pelangganId, Number(pelangganId)));
  if (q) {
    const pat = `%${q}%`;
    ordConds.push(
      or(
        like(orderHeader.nomorOrder, pat),
        like(pelangganTable.nama, pat),
      )!,
    );
  }

  const ordRows = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      createdAt: orderHeader.createdAt,
      total: orderHeader.totalEstimasi,
      status: orderHeader.status,
      statusBayar: orderHeader.statusBayar,
      metodeBayar: orderHeader.metodeBayar,
      sumber: orderHeader.sumber,
      alamatAntar: orderHeader.alamatAntar,
      kurirNama: userTable.name,
      pelangganNama: pelangganTable.nama,
    })
    .from(orderHeader)
    .leftJoin(userTable, eq(orderHeader.kurirUserId, userTable.id))
    .leftJoin(pelangganTable, eq(orderHeader.pelangganId, pelangganTable.id))
    .where(ordConds.length ? and(...ordConds) : undefined)
    .orderBy(desc(orderHeader.createdAt))
    .limit(500);

  const ordIds = ordRows.map((o) => o.id);
  const ordGalonMap = new Map<number, number>();
  if (ordIds.length) {
    const r = await db
      .select({ orderId: orderItem.orderId, qty: orderItem.qty })
      .from(orderItem)
      .where(inArray(orderItem.orderId, ordIds));
    for (const it of r) ordGalonMap.set(it.orderId, (ordGalonMap.get(it.orderId) ?? 0) + it.qty);
  }

  // ====== Merge & sort ======
  const all: UnifiedRow[] = [
    ...trxRows.map((t) => ({
      kind: "transaksi" as const,
      id: t.id,
      nomor: t.nomorNota,
      createdAt: t.createdAt,
      total: t.total,
      statusBayar: t.voidedAt ? "batal" : "lunas",
      statusOrder: null,
      metodeBayar: t.metodeBayar,
      sumber: "POS depot",
      kasirKurirNama: t.kasirNama,
      pelangganNama: t.pelangganNama,
      qtyGalon: trxGalonMap.get(t.id) ?? 0,
      voided: !!t.voidedAt,
    })),
    ...ordRows.map((o) => ({
      kind: "order" as const,
      id: o.id,
      nomor: o.nomorOrder,
      createdAt: o.createdAt,
      total: o.total,
      statusBayar: o.status === "batal" ? "batal" : o.statusBayar,
      statusOrder: o.status,
      metodeBayar: o.metodeBayar,
      sumber:
        o.sumber === "walk-in"
          ? o.alamatAntar === "(diambil di depot)"
            ? "POS depot"
            : "Walk-in antar"
          : `Order ${o.sumber}`,
      kasirKurirNama: o.kurirNama,
      pelangganNama: o.pelangganNama,
      qtyGalon: ordGalonMap.get(o.id) ?? 0,
      voided: o.status === "batal",
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Paginate
  const total = all.length;
  const { page, totalPages, offset } = getPagination({ total, limit, page: pageParam });
  const paged = all.slice(offset, offset + limit);

  const totalOmzet = all.filter((r) => !r.voided).reduce((s, r) => s + r.total, 0);
  const totalGalon = all.filter((r) => !r.voided).reduce((s, r) => s + r.qtyGalon, 0);

  // User + pelanggan dropdown
  const [userList, pelangganList] = await Promise.all([
    db
      .select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .where(inArray(userTable.role, ["admin", "kasir", "kurir"])),
    db
      .select({ id: pelangganTable.id, nama: pelangganTable.nama })
      .from(pelangganTable)
      .orderBy(pelangganTable.nama)
      .limit(500),
  ]);

  const fromStr = range.from?.toISOString().slice(0, 10) ?? "";
  const toStr = range.to?.toISOString().slice(0, 10) ?? "";

  const STATUS_BADGE: Record<string, string> = {
    lunas: "bg-emerald-100 text-emerald-800",
    belum: "bg-amber-100 text-amber-800",
    menunggu: "bg-blue-100 text-blue-800",
    batal: "bg-rose-100 text-rose-800",
  };

  return (
    <div className="p-4 md:p-6 space-y-4 laporan-print">
      <PrintStyles />
      <div className="no-print">
        <PageHeader
          title="Semua Aktivitas"
          description="Gabungan transaksi POS + order antar. 1 tabel komprehensif."
        />
      </div>
      <LaporanNav active="/admin/laporan/semua" />

      <PrintHeader title="LAPORAN SEMUA AKTIVITAS" fromStr={fromStr} toStr={toStr} />

      <FilterBar
        basePath="/admin/laporan/semua"
        rangeKey={range.key}
        rangeFrom={range.from}
        rangeTo={range.to}
        q={q}
        userId={userId}
        userList={userList}
        userLabel="Kasir/Kurir"
        pelangganId={pelangganId}
        pelangganList={pelangganList}
        showPelanggan
        extraHidden={{ status: statusFilter !== "all" ? statusFilter : undefined }}
      />

      <form className="flex gap-2 items-center text-xs no-print">
        {range.key && range.key !== "month" && <input type="hidden" name="range" value={range.key} />}
        {q && <input type="hidden" name="q" value={q} />}
        {userId && <input type="hidden" name="userId" value={userId} />}
        {pelangganId && <input type="hidden" name="pelangganId" value={pelangganId} />}
        <AutoSubmitSelect
          name="status"
          value={statusFilter}
          label="Status:"
          options={[
            { value: "all", label: "Semua" },
            { value: "lunas", label: "Lunas" },
            { value: "piutang", label: "Piutang" },
            { value: "aktif", label: "Order Aktif" },
            { value: "batal", label: "Batal" },
          ]}
        />
      </form>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="grid grid-cols-3 gap-2 text-sm flex-1 min-w-0">
          <SumCard label="Aktivitas" value={String(total)} />
          <SumCard label="Omzet" value={formatRupiah(totalOmzet)} highlight />
          <SumCard label="Galon" value={String(totalGalon)} />
        </div>
        <PageSizeSelect value={limit} />
      </div>

      <ExportActions
        jenis="semua"
        params={{
          range: range.key,
          from: fromStr,
          to: toStr,
          q,
          userId,
          pelangganId,
          status: statusFilter !== "all" ? statusFilter : undefined,
        }}
      />

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <LaporanClickProvider>
          <table className="w-full text-xs">
            <thead className="bg-[color:var(--surface2)] text-[color:var(--muted)] text-left">
              <tr>
                <th className="p-2">Tanggal</th>
                <th className="p-2">Sumber</th>
                <th className="p-2">Nomor</th>
                <th className="p-2">Kasir/Kurir</th>
                <th className="p-2">Pelanggan</th>
                <th className="p-2 text-right">Galon</th>
                <th className="p-2">Bayar</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paged.map((r) => (
                <LaporanRow
                  key={`${r.kind}-${r.id}`}
                  target={{ kind: r.kind, id: r.id }}
                  className={r.voided ? "opacity-50 line-through" : ""}
                >
                  <td className="p-2 whitespace-nowrap">
                    {r.createdAt.toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        r.kind === "order"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-violet-50 text-violet-700"
                      }`}
                    >
                      {r.sumber}
                    </span>
                  </td>
                  <td className="p-2 font-mono">{r.nomor}</td>
                  <td className="p-2">{r.kasirKurirNama ?? "-"}</td>
                  <td className="p-2">{r.pelangganNama ?? "—"}</td>
                  <td className="p-2 text-right">{r.qtyGalon}</td>
                  <td className="p-2 uppercase">{r.metodeBayar ?? "-"}</td>
                  <td className="p-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        STATUS_BADGE[r.statusBayar] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {r.statusBayar.toUpperCase()}
                    </span>
                    {r.statusOrder && r.statusOrder !== "selesai" && !r.voided && (
                      <span className="ml-1 text-[10px] text-[color:var(--muted)] uppercase">
                        · {r.statusOrder}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-right font-bold">{formatRupiah(r.total)}</td>
                </LaporanRow>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[color:var(--muted)]">
                    Tidak ada aktivitas pada filter ini.
                  </td>
                </tr>
              )}
            </tbody>
            {paged.length > 0 && (
              <tfoot className="bg-[color:var(--surface2)] font-bold">
                <tr>
                  <td colSpan={8} className="p-2 text-right">
                    TOTAL halaman ini:
                  </td>
                  <td className="p-2 text-right text-brand">
                    {formatRupiah(paged.filter((r) => !r.voided).reduce((s, r) => s + r.total, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          </LaporanClickProvider>
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}

function SumCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-line px-3 py-2 ${
        highlight ? "bg-emerald-50 text-emerald-700" : "bg-surface"
      }`}
    >
      <div className="text-[10px] tracking-widest font-bold text-[color:var(--muted)]">
        {label}
      </div>
      <div className="text-base font-extrabold mt-0.5">{value}</div>
    </div>
  );
}
