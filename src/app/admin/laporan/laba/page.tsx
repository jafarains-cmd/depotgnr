import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/permissions";
import { formatRupiah } from "@/lib/utils";
import { parseRange } from "@/lib/date-range";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { LaporanNav } from "../LaporanNav";
import { PrintStyles, PrintHeader } from "../PrintStyles";
import { hitungLaba } from "@/lib/analisis-laba";

export const dynamic = "force-dynamic";

export default async function AnalisisLabaPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const range = parseRange(sp);
  const from = range.from ?? new Date(new Date().setDate(1)); // fallback: awal bulan
  const to = range.to ?? new Date();

  const { summary, breakdownCOGS, breakdownOp, amortisasiDetail } =
    await hitungLaba(from, to);

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const labaBersihPositif = summary.labaBersih >= 0;

  return (
    <div className="p-4 md:p-6 space-y-4 laporan-print max-w-5xl">
      <PrintStyles />
      <div className="no-print">
        <PageHeader
          title="Analisis Laba"
          description="Perhitungan laba kotor & bersih. Termasuk amortisasi sparepart (membran, filter, mesin) yang tersebar sesuai umur pakai."
        />
      </div>
      <LaporanNav active="/admin/laporan/laba" />

      <PrintHeader title="ANALISIS LABA" fromStr={fromStr} toStr={toStr} />

      <div className="no-print">
        <DateRangeFilter
          active={range.key}
          customFrom={from}
          customTo={to}
          basePath="/admin/laporan/laba"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <BigCard label="OMZET" value={summary.omzetTotal} color="emerald" />
        <BigCard label="COGS TOTAL" value={summary.cogsTotal} color="rose" negative />
        <BigCard
          label="OP. EXPENSE"
          value={summary.opExCash}
          color="amber"
          negative
        />
        <BigCard
          label="LABA BERSIH"
          value={summary.labaBersih}
          color={labaBersihPositif ? "blue" : "rose"}
          highlight
        />
      </div>

      {/* Laba Kotor & Bersih Banner */}
      <section
        className={`rounded-2xl border p-4 ${
          labaBersihPositif
            ? "bg-emerald-50 border-emerald-200"
            : "bg-rose-50 border-rose-200"
        }`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[color:var(--muted)]">
              💰 LABA KOTOR
            </div>
            <div className="text-2xl md:text-3xl font-extrabold tabular-nums mt-0.5">
              {formatRupiah(summary.labaKotor)}
            </div>
            <div className="text-xs text-[color:var(--muted)] mt-1">
              ({summary.labaKotorPersen.toFixed(1)}% dari omzet)
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[color:var(--muted)]">
              ✨ LABA BERSIH
            </div>
            <div
              className={`text-2xl md:text-3xl font-extrabold tabular-nums mt-0.5 ${
                labaBersihPositif ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {summary.labaBersih >= 0 ? "+" : ""}
              {formatRupiah(summary.labaBersih)}
            </div>
            <div className="text-xs text-[color:var(--muted)] mt-1">
              ({summary.labaBersihPersen.toFixed(1)}% dari omzet)
            </div>
          </div>
        </div>
      </section>

      {/* Breakdown Omzet */}
      <section className="bg-surface border border-line rounded-2xl p-4 space-y-2">
        <h2 className="font-extrabold text-sm inline-flex items-center gap-1.5">
          <span className="text-emerald-700">📈</span> OMZET — Rincian
        </h2>
        <BreakdownRow
          label="POS langsung (kasir depot)"
          amount={summary.omzetPOS}
          color="text-emerald-700"
        />
        <BreakdownRow
          label="Order Antar lunas"
          amount={summary.omzetOrder}
          color="text-emerald-700"
        />
        <div className="pt-2 border-t border-line flex justify-between text-sm font-extrabold">
          <span>Total Omzet</span>
          <span className="tabular-nums text-emerald-700">
            {formatRupiah(summary.omzetTotal)}
          </span>
        </div>
      </section>

      {/* Breakdown COGS */}
      <section className="bg-surface border border-line rounded-2xl p-4 space-y-2">
        <h2 className="font-extrabold text-sm inline-flex items-center gap-1.5">
          <span className="text-rose-700">📦</span> COGS — Biaya Langsung Produksi
        </h2>

        {breakdownCOGS.length === 0 && amortisasiDetail.length === 0 ? (
          <div className="text-xs text-[color:var(--muted)] italic">
            Belum ada biaya COGS di periode ini. Klasifikasikan pengeluaran ke
            kategori bertipe COGS di{" "}
            <a href="/admin/kategori-biaya" className="text-brand underline">
              Kategori Biaya
            </a>
            .
          </div>
        ) : (
          <>
            {breakdownCOGS.map((b) => (
              <BreakdownRow
                key={`cogs-${b.kategoriId ?? b.slug}`}
                label={b.nama}
                sublabel={`${b.count} entri`}
                amount={b.jumlah}
                color="text-rose-700"
              />
            ))}

            {amortisasiDetail.length > 0 && (
              <>
                <div className="pt-2 mt-2 border-t border-line">
                  <div className="text-[10px] font-bold tracking-widest text-violet-700 mb-1">
                    AMORTISASI SPAREPART (tersebar sesuai umur pakai)
                  </div>
                  {amortisasiDetail.map((a) => (
                    <div
                      key={`amort-${a.filterId}`}
                      className="flex justify-between items-start gap-2 py-1.5 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-violet-900">
                          {a.filterNama}
                        </div>
                        <div className="text-[10px] text-[color:var(--muted)]">
                          {formatRupiah(a.hargaBeli)} ÷ {a.intervalHari} hari
                          {" · "}
                          <span
                            className={
                              a.progressPersen >= 100
                                ? "text-rose-700 font-bold"
                                : a.progressPersen >= 85
                                  ? "text-amber-700"
                                  : ""
                            }
                          >
                            {a.progressPersen}% umur
                            {a.progressPersen >= 100 && " ⚠ WAKTUNYA GANTI"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-violet-700 tabular-nums">
                          {formatRupiah(a.biayaBulanIni)}
                        </div>
                        <div className="text-[10px] text-[color:var(--muted)]">
                          {a.hariAktifDiPeriode} hari
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold pt-1.5 mt-1 border-t border-violet-200">
                    <span className="text-violet-800">Sub-total Amortisasi</span>
                    <span className="tabular-nums text-violet-700">
                      {formatRupiah(summary.cogsAmortisasi)}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="pt-2 border-t border-line flex justify-between text-sm font-extrabold">
              <span>Total COGS</span>
              <span className="tabular-nums text-rose-700">
                {formatRupiah(summary.cogsTotal)}
              </span>
            </div>
          </>
        )}
      </section>

      {/* Breakdown Operasional */}
      <section className="bg-surface border border-line rounded-2xl p-4 space-y-2">
        <h2 className="font-extrabold text-sm inline-flex items-center gap-1.5">
          <span className="text-amber-700">🚚</span> OPERASIONAL — Biaya Jalan Bisnis
        </h2>

        {breakdownOp.length === 0 ? (
          <div className="text-xs text-[color:var(--muted)] italic">
            Belum ada biaya operasional di periode ini.
          </div>
        ) : (
          <>
            {breakdownOp.map((b) => (
              <div
                key={`op-${b.kategoriId ?? b.slug}`}
                className="flex justify-between items-baseline gap-2 py-1"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{b.nama}</div>
                  <div className="text-[10px] text-[color:var(--muted)]">
                    {b.count} entri
                    {b.tipe === "uncategorized" && (
                      <span className="text-amber-700 font-bold">
                        {" · ⚠ Belum ter-klasifikasi"}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`text-sm font-bold tabular-nums shrink-0 ${
                    b.tipe === "uncategorized" ? "text-amber-700" : "text-amber-800"
                  }`}
                >
                  {formatRupiah(b.jumlah)}
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-line flex justify-between text-sm font-extrabold">
              <span>Total Operasional</span>
              <span className="tabular-nums text-amber-800">
                {formatRupiah(summary.opExCash)}
              </span>
            </div>
          </>
        )}

        {summary.pengeluaranTanpaKategori > 0 && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-900">
            ⚠ Ada <b>{formatRupiah(summary.pengeluaranTanpaKategori)}</b>{" "}
            pengeluaran belum ter-klasifikasi ke master. Buka{" "}
            <a href="/admin/pengeluaran" className="text-brand underline">
              /admin/pengeluaran
            </a>{" "}
            untuk edit + assign kategori supaya klasifikasi COGS vs Operasional
            akurat.
          </div>
        )}
      </section>

      {/* Info footer */}
      <div className="bg-[color:var(--surface2)] rounded-xl p-3 text-[11px] text-[color:var(--muted)] leading-relaxed no-print">
        <b>Cara baca:</b>
        <ul className="list-disc list-inside mt-1 space-y-0.5">
          <li>
            <b>Omzet</b> = uang masuk dari penjualan (POS + Order lunas).
          </li>
          <li>
            <b>COGS</b> = biaya langsung produksi (air baku, listrik produksi,
            sparepart yang di-amortisasi). Ini yang bikin air jadi produk siap
            jual.
          </li>
          <li>
            <b>Laba Kotor</b> = Omzet − COGS. Kalau {"<"} 50%, pertimbangkan
            naikkan harga atau tekan biaya produksi.
          </li>
          <li>
            <b>Op. Expense</b> = biaya jalan bisnis (bensin, ongkos kurir, gaji,
            sewa).
          </li>
          <li>
            <b>Laba Bersih</b> = Laba Kotor − Op. Expense. Ini yang beneran jadi
            uang untuk Anda.
          </li>
        </ul>
        <div className="mt-2">
          <b>Amortisasi:</b> membran Rp 300rb umur 180 hari = biaya per hari Rp
          1.667. Kalau periode 30 hari → tercatat Rp 50rb sebagai biaya bulan
          ini (bukan Rp 300rb sekaligus). Ini bikin laba bulanan lebih akurat.
        </div>
      </div>
    </div>
  );
}

function BigCard({
  label,
  value,
  color,
  negative,
  highlight,
}: {
  label: string;
  value: number;
  color: "emerald" | "rose" | "blue" | "amber";
  negative?: boolean;
  highlight?: boolean;
}) {
  const colorMap = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div
      className={`rounded-xl border px-2 md:px-3 py-2 min-w-0 ${colorMap[color]} ${highlight ? "ring-2 ring-offset-1 ring-blue-300" : ""}`}
    >
      <div className="text-[10px] tracking-widest font-bold opacity-80 truncate">
        {label}
      </div>
      <div className="text-sm md:text-base font-extrabold mt-0.5 tabular-nums truncate">
        {negative && value > 0 ? "−" : ""}
        {value >= 0 ? "" : ""}
        {formatRupiah(Math.abs(value))}
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  sublabel,
  amount,
  color,
}: {
  label: string;
  sublabel?: string;
  amount: number;
  color?: string;
}) {
  return (
    <div className="flex justify-between items-baseline gap-2 py-1">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">{label}</div>
        {sublabel && (
          <div className="text-[10px] text-[color:var(--muted)]">{sublabel}</div>
        )}
      </div>
      <div className={`text-sm font-bold tabular-nums shrink-0 ${color ?? ""}`}>
        {formatRupiah(amount)}
      </div>
    </div>
  );
}
