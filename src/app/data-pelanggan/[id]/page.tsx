import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc, and, sql, inArray, isNull, gt, lt } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import {
  pelanggan as pelangganTable,
  mutasiLoyalti,
  galonPelanggan,
  mutasiTitipan,
} from "@/db/schema/pelanggan";
import { produk as produkTable } from "@/db/schema/produk";
import { user as userTableSchema } from "@/db/schema/auth";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireRole } from "@/lib/permissions";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { orderHeader, orderItem } from "@/db/schema/order";
import { TitipanSection } from "./TitipanSection";
import { GalonPinjamSection } from "./GalonPinjamSection";
import { LinkUserSection } from "./LinkUserSection";
import { getSaldoGalonPinjam, getHistoryGalonPinjam } from "@/lib/galon-pinjam";
import { LoyaltyHistoryTable } from "./LoyaltyHistoryTable";
import { LoyaltyStatCards } from "./LoyaltyStatCards";
import { RiwayatTransaksiTable, type RiwayatItem } from "./RiwayatTransaksiTable";
import { formatRupiah } from "@/lib/utils";
import { LoyaltyAdjustForm } from "./LoyaltyAdjustForm";
import { LimitGalonEditor } from "./LimitGalonEditor";
import { getDefaultLimitGalon, getEffectiveLimitGalon } from "@/lib/langganan";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { parseLimit, parsePage, getPagination } from "@/lib/page-size";

export const dynamic = "force-dynamic";

export default async function PelangganDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ limit?: string; page?: string }>;
}) {
  const session = await requireRole(["admin", "kasir"]);
  const isAdmin = session.user.role === "admin";
  const { id } = await params;
  const sp = await searchParams;
  const limit = parseLimit(sp.limit);
  const pageParam = parsePage(sp.page);
  const pelangganId = Number(id);
  if (!pelangganId) notFound();

  const pel = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable.id, pelangganId),
  });
  if (!pel) notFound();

  const linkedUser = pel.userId
    ? await db.query.user.findFirst({ where: eq(userTableSchema.id, pel.userId) })
    : null;

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(mutasiLoyalti)
    .where(eq(mutasiLoyalti.pelangganId, pelangganId));
  const totalMutasi = countRow?.n ?? 0;
  const { page, totalPages, offset } = getPagination({
    total: totalMutasi,
    limit,
    page: pageParam,
  });

  const mutasi = await db
    .select()
    .from(mutasiLoyalti)
    .where(eq(mutasiLoyalti.pelangganId, pelangganId))
    .orderBy(desc(mutasiLoyalti.createdAt))
    .limit(limit)
    .offset(offset);

  // ====== Riwayat Transaksi Unified (POS + Order Antar) ======
  // Ambil 50 order terakhir + 50 transaksi non-order. Lalu merge & sort di JS.
  const orderRows = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      createdAt: orderHeader.createdAt,
      total: orderHeader.totalEstimasi,
      statusBayar: orderHeader.statusBayar,
      statusOrder: orderHeader.status,
      metodeBayar: orderHeader.metodeBayar,
      sumber: orderHeader.sumber,
      alamatAntar: orderHeader.alamatAntar,
    })
    .from(orderHeader)
    .where(eq(orderHeader.pelangganId, pelangganId))
    .orderBy(desc(orderHeader.createdAt))
    .limit(50);

  const trxRows = await db
    .select({
      id: transaksi.id,
      nomorNota: transaksi.nomorNota,
      createdAt: transaksi.createdAt,
      total: transaksi.total,
      metodeBayar: transaksi.metodeBayar,
    })
    .from(transaksi)
    .where(
      and(
        eq(transaksi.pelangganId, pelangganId),
        isNull(transaksi.refOrderId), // skip transaksi yang punya order (anti-duplikasi)
        isNull(transaksi.voidedAt),
      ),
    )
    .orderBy(desc(transaksi.createdAt))
    .limit(50);

  // Hitung galon per order & transaksi
  const orderIds = orderRows.map((o) => o.id);
  const trxIds = trxRows.map((t) => t.id);
  const galonOrderMap = new Map<number, number>();
  const galonTrxMap = new Map<number, number>();
  if (orderIds.length) {
    const r = await db
      .select({ orderId: orderItem.orderId, qty: orderItem.qty })
      .from(orderItem)
      .where(inArray(orderItem.orderId, orderIds));
    for (const it of r) galonOrderMap.set(it.orderId, (galonOrderMap.get(it.orderId) ?? 0) + it.qty);
  }
  if (trxIds.length) {
    const r = await db
      .select({ transaksiId: transaksiItem.transaksiId, qty: transaksiItem.qty })
      .from(transaksiItem)
      .where(inArray(transaksiItem.transaksiId, trxIds));
    for (const it of r) galonTrxMap.set(it.transaksiId, (galonTrxMap.get(it.transaksiId) ?? 0) + it.qty);
  }

  const riwayatItems: RiwayatItem[] = [
    ...orderRows.map((o) => ({
      kind: "order" as const,
      id: o.id,
      nomor: o.nomorOrder,
      createdAt: o.createdAt.toISOString(),
      total: o.total,
      statusBayar: o.statusBayar,
      statusOrder: o.statusOrder,
      metodeBayar: o.metodeBayar,
      sumber:
        o.sumber === "walk-in"
          ? o.alamatAntar === "(diambil di depot)"
            ? "POS depot"
            : "Walk-in antar"
          : `Order ${o.sumber}`,
      qtyGalon: galonOrderMap.get(o.id) ?? 0,
    })),
    ...trxRows.map((t) => ({
      kind: "transaksi" as const,
      id: t.id,
      nomor: t.nomorNota,
      createdAt: t.createdAt.toISOString(),
      total: t.total,
      statusBayar: "lunas",
      metodeBayar: t.metodeBayar,
      sumber: "POS depot",
      qtyGalon: galonTrxMap.get(t.id) ?? 0,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Total piutang pelanggan (order selesai, statusBayar belum) = sum sisa
  const [piutangRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${orderHeader.totalEstimasi} - ${orderHeader.paidPartial}), 0)`,
      jumlahOrder: sql<number>`coalesce(count(*), 0)`,
    })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.pelangganId, pelangganId),
        eq(orderHeader.status, "selesai"),
        eq(orderHeader.statusBayar, "belum"),
      ),
    );
  const piutangTotal = Number(piutangRow?.total ?? 0);
  const piutangJumlah = Number(piutangRow?.jumlahOrder ?? 0);

  // Galon titipan + produk list + history mutasi titipan
  const titipanRows = await db
    .select({
      produkId: galonPelanggan.produkId,
      jumlahDititip: galonPelanggan.jumlahDititip,
      produkNama: produkTable.nama,
    })
    .from(galonPelanggan)
    .leftJoin(produkTable, eq(galonPelanggan.produkId, produkTable.id))
    .where(eq(galonPelanggan.pelangganId, pelangganId));

  const semuaProduk = await db
    .select({ id: produkTable.id, nama: produkTable.nama })
    .from(produkTable);

  const titipanMutasi = await db
    .select({
      id: mutasiTitipan.id,
      produkId: mutasiTitipan.produkId,
      produkNama: produkTable.nama,
      perubahan: mutasiTitipan.perubahan,
      alasan: mutasiTitipan.alasan,
      catatan: mutasiTitipan.catatan,
      createdAt: mutasiTitipan.createdAt,
      userName: userTableSchema.name,
    })
    .from(mutasiTitipan)
    .leftJoin(produkTable, eq(mutasiTitipan.produkId, produkTable.id))
    .leftJoin(userTableSchema, eq(mutasiTitipan.userId, userTableSchema.id))
    .where(eq(mutasiTitipan.pelangganId, pelangganId))
    .orderBy(desc(mutasiTitipan.createdAt))
    .limit(30);

  const [earnRow] = await db
    .select({ total: sql<number>`coalesce(sum(${mutasiLoyalti.jumlah}), 0)` })
    .from(mutasiLoyalti)
    .where(and(eq(mutasiLoyalti.pelangganId, pelangganId), sql`${mutasiLoyalti.jumlah} > 0`));
  const [redeemRow] = await db
    .select({ total: sql<number>`coalesce(sum(${mutasiLoyalti.jumlah}), 0)` })
    .from(mutasiLoyalti)
    .where(and(eq(mutasiLoyalti.pelangganId, pelangganId), sql`${mutasiLoyalti.jumlah} < 0`));

  const totalEarn = earnRow.total;
  const totalRedeem = Math.abs(redeemRow.total);

  // Detail per-card untuk modal (30 terbaru per kategori)
  const [earnList, redeemList, stampList, recentList, cfgRows] = await Promise.all([
    db
      .select()
      .from(mutasiLoyalti)
      .where(and(eq(mutasiLoyalti.pelangganId, pelangganId), gt(mutasiLoyalti.jumlah, 0)))
      .orderBy(desc(mutasiLoyalti.createdAt))
      .limit(30),
    db
      .select()
      .from(mutasiLoyalti)
      .where(and(eq(mutasiLoyalti.pelangganId, pelangganId), lt(mutasiLoyalti.jumlah, 0)))
      .orderBy(desc(mutasiLoyalti.createdAt))
      .limit(30),
    db
      .select()
      .from(mutasiLoyalti)
      .where(and(eq(mutasiLoyalti.pelangganId, pelangganId), eq(mutasiLoyalti.tipe, "stamp_reward")))
      .orderBy(desc(mutasiLoyalti.createdAt))
      .limit(30),
    db
      .select()
      .from(mutasiLoyalti)
      .where(eq(mutasiLoyalti.pelangganId, pelangganId))
      .orderBy(desc(mutasiLoyalti.createdAt))
      .limit(10),
    db.select({ key: pengaturan.key, value: pengaturan.value }).from(pengaturan),
  ]);

  const cfgMap = Object.fromEntries(cfgRows.map((r) => [r.key, r.value ?? ""]));
  const stampThreshold = Math.max(1, Number(cfgMap.stampThresholdGalon) || 10);
  const nilaiGalonGratis = Math.max(0, Number(cfgMap.nilaiGalonGratis) || 5000);

  const toMutasiRow = (m: (typeof earnList)[number]) => ({
    id: m.id,
    tipe: m.tipe,
    jumlah: m.jumlah,
    deskripsi: m.deskripsi,
    refOrderId: m.refOrderId,
    refTransaksiId: m.refTransaksiId,
    createdAt: m.createdAt.toISOString(),
  });

  // Galon depot dipinjam + history
  const saldoGalonPinjam = await getSaldoGalonPinjam(pelangganId);
  const [defaultLimitGalon, effectiveLimitGalon] = await Promise.all([
    getDefaultLimitGalon(),
    getEffectiveLimitGalon(pelangganId),
  ]);
  const historyGalonPinjam = await getHistoryGalonPinjam(pelangganId, 30);
  const historyGalonPinjamWithUser = await Promise.all(
    historyGalonPinjam.map(async (m) => {
      const u = m.userId
        ? await db.query.user.findFirst({ where: eq(userTableSchema.id, m.userId) })
        : null;
      return { ...m, userName: u?.name ?? null };
    }),
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-4">
      <Link
        href="/data-pelanggan"
        className="text-sm text-[color:var(--muted)] hover:text-brand inline-flex items-center gap-1"
      >
        <ArrowLeft size={14} /> Kembali
      </Link>

      <div className="bg-surface border border-line rounded-2xl p-5">
        <h1 className="text-2xl font-extrabold tracking-tight">{pel.nama}</h1>
        <div className="text-sm text-[color:var(--muted)] mt-1 space-y-0.5">
          {pel.telp && <div>📞 {pel.telp}</div>}
          {pel.alamat && <div>📍 {pel.alamat}</div>}
          <div>
            Tipe:{" "}
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                pel.tipe === "langganan"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-[color:var(--surface2)] text-[color:var(--muted)]"
              }`}
            >
              {pel.tipe}
            </span>
            {pel.kodeReferral && (
              <span className="ml-3">
                Kode referral: <span className="font-mono font-bold">{pel.kodeReferral}</span>
              </span>
            )}
          </div>
        </div>

        {pel.tipe === "langganan" && isAdmin && (
          <LimitGalonEditor
            pelangganId={pelangganId}
            currentLimit={pel.limitGalon ?? null}
            effectiveLimit={effectiveLimitGalon}
            defaultLimit={defaultLimitGalon}
            galonDipegang={saldoGalonPinjam.total}
          />
        )}
      </div>

      <LoyaltyStatCards
        saldoLoyalti={pel.saldoLoyalti}
        stampGalon={pel.stampGalon}
        stampClaimedCount={pel.stampClaimedCount}
        stampThreshold={stampThreshold}
        nilaiGalonGratis={nilaiGalonGratis}
        totalEarn={totalEarn}
        totalRedeem={totalRedeem}
        earnList={earnList.map(toMutasiRow)}
        redeemList={redeemList.map(toMutasiRow)}
        stampList={stampList.map(toMutasiRow)}
        recentList={recentList.map(toMutasiRow)}
      />

      {piutangTotal > 0 && (
        <Link
          href={`/pembayaran?tab=piutang&q=${encodeURIComponent(pel.nama)}`}
          className="block bg-red-50 border border-red-200 rounded-2xl p-4 hover:bg-red-100"
        >
          <div className="text-[10px] font-bold tracking-widest text-red-700">
            ⚠ PIUTANG BELUM LUNAS
          </div>
          <div className="text-2xl font-extrabold text-red-900 mt-1">
            {formatRupiah(piutangTotal)}
          </div>
          <div className="text-xs text-red-700 mt-0.5">
            {piutangJumlah} order belum lunas · klik untuk kelola di /pembayaran
          </div>
        </Link>
      )}

      {isAdmin && (
        <LinkUserSection
          pelangganId={pel.id}
          pelangganNama={pel.nama}
          currentUserId={pel.userId}
          currentUserName={linkedUser?.name ?? null}
          currentUserEmail={linkedUser?.email ?? null}
          currentUserTelp={linkedUser?.phoneNumber ?? null}
        />
      )}

      {isAdmin && <LoyaltyAdjustForm pelangganId={pel.id} />}

      <TitipanSection
        pelangganId={pel.id}
        pelangganNama={pel.nama}
        titipan={titipanRows.map((t) => ({
          produkId: t.produkId,
          produkNama: t.produkNama ?? `#${t.produkId}`,
          jumlahDititip: t.jumlahDititip,
        }))}
        semuaProduk={semuaProduk}
        recentMutasi={titipanMutasi.map((m) => ({
          id: m.id,
          produkId: m.produkId,
          produkNama: m.produkNama ?? `#${m.produkId}`,
          perubahan: m.perubahan,
          alasan: m.alasan,
          catatan: m.catatan,
          createdAt: m.createdAt.toISOString(),
          userName: m.userName,
        }))}
      />

      <GalonPinjamSection
        pelangganId={pel.id}
        pelangganNama={pel.nama}
        saldo={saldoGalonPinjam.perProduk.map((p) => ({
          produkId: p.produkId,
          produkNama: p.namaProduk,
          jumlah: p.jumlah,
        }))}
        semuaProduk={semuaProduk}
        recentMutasi={historyGalonPinjamWithUser.map((m) => ({
          id: m.id,
          produkId: m.produkId,
          produkNama: m.namaProduk ?? `#${m.produkId}`,
          perubahan: m.perubahan,
          tipe: m.tipe,
          alasan: m.alasan,
          refTransaksiId: m.refTransaksiId,
          refOrderId: m.refOrderId,
          galonSerial: m.galonSerial,
          userName: m.userName,
          createdAt: m.createdAt.toISOString(),
        }))}
        canEdit
      />

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="font-bold">Riwayat Transaksi</h2>
          <p className="text-xs text-[color:var(--muted)]">
            Gabungan POS depot + order antar (50 terbaru). Klik baris untuk lihat detail.
          </p>
        </div>
        <RiwayatTransaksiTable items={riwayatItems} />
      </div>

      <div className="flex items-center justify-end">
        <PageSizeSelect value={limit} />
      </div>

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="font-bold">History Loyalty</h2>
          <p className="text-xs text-[color:var(--muted)]">
            {limit} mutasi terbaru · earn dari order, redeem saat bayar, atau adjust manual admin
          </p>
        </div>
        {mutasi.length === 0 ? (
          <div className="p-6 text-center text-sm text-[color:var(--muted)]">
            Belum ada mutasi loyalty.
          </div>
        ) : (
          <LoyaltyHistoryTable
            mutasi={mutasi.map((m) => ({
              id: m.id,
              tipe: m.tipe,
              jumlah: m.jumlah,
              deskripsi: m.deskripsi,
              refOrderId: m.refOrderId,
              refTransaksiId: m.refTransaksiId,
              createdAt: m.createdAt.toISOString(),
            }))}
          />
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} total={totalMutasi} />
    </div>
  );
}

