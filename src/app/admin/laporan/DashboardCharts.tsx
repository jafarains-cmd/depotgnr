"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatRupiah } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ======= Types =======
export type OmzetHarian = {
  tanggal: string;
  omzetPOS: number;
  omzetOrder: number;
  total: number;
};
export type GalonHarian = {
  tanggal: string;
  galon: number;
};
export type MetodeBayar = {
  metode: string;
  jumlah: number;
  total: number;
};
export type PelangganBaru = {
  periode: string;
  jumlah: number;
};
export type OmzetVsPengeluaran = {
  tanggal: string;
  omzet: number;
  pengeluaran: number;
};

type Props = {
  omzetHarian: OmzetHarian[];
  galonHarian: GalonHarian[];
  metodeBayar: MetodeBayar[];
  pelangganBaru: PelangganBaru[];
  omzetVsPengeluaran: OmzetVsPengeluaran[];
};

const COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function fmtRp(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return String(v);
}

function fmtTgl(s: string) {
  return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export function DashboardCharts({
  omzetHarian,
  galonHarian,
  metodeBayar,
  pelangganBaru,
  omzetVsPengeluaran,
}: Props) {
  const [detail, setDetail] = useState<{
    title: string;
    rows: { label: string; value: string }[];
  } | null>(null);

  function showDetail(title: string, rows: { label: string; value: string }[]) {
    setDetail({ title, rows });
  }

  return (
    <div className="space-y-6">
      {/* 1. Omzet Harian (POS + Order) */}
      <section className="bg-surface border border-line rounded-2xl p-4">
        <h2 className="font-semibold mb-1">Omzet Harian</h2>
        <p className="text-xs text-[color:var(--muted)] mb-3">
          POS depot (biru) + Order antar lunas (hijau). Klik bar untuk detail.
        </p>
        {omzetHarian.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={omzetHarian}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="tanggal" tickFormatter={fmtTgl} fontSize={10} />
              <YAxis tickFormatter={fmtRp} fontSize={10} width={50} />
              <Tooltip
                formatter={(v: any, name: any) => [
                  formatRupiah(Number(v)),
                  name === "omzetPOS" ? "POS Depot" : "Order Antar",
                ]}
                labelFormatter={(l: any) => fmtTgl(String(l))}
              />
              <Legend
                formatter={(v: any) => (v === "omzetPOS" ? "POS Depot" : "Order Antar")}
              />
              <Bar
                dataKey="omzetPOS"
                stackId="omzet"
                fill="#0ea5e9"
                radius={[0, 0, 0, 0]}
                cursor="pointer"
                onClick={(d: any) =>
                  showDetail(`Omzet ${fmtTgl(d.tanggal)}`, [
                    { label: "POS Depot", value: formatRupiah(d.omzetPOS) },
                    { label: "Order Antar", value: formatRupiah(d.omzetOrder) },
                    { label: "Total", value: formatRupiah(d.total) },
                  ])
                }
              />
              <Bar
                dataKey="omzetOrder"
                stackId="omzet"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(d: any) =>
                  showDetail(`Omzet ${fmtTgl(d.tanggal)}`, [
                    { label: "POS Depot", value: formatRupiah(d.omzetPOS) },
                    { label: "Order Antar", value: formatRupiah(d.omzetOrder) },
                    { label: "Total", value: formatRupiah(d.total) },
                  ])
                }
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* 2. Galon Terjual per Hari */}
      <section className="bg-surface border border-line rounded-2xl p-4">
        <h2 className="font-semibold mb-1">Galon Terjual per Hari</h2>
        <p className="text-xs text-[color:var(--muted)] mb-3">
          Total galon (POS + order). Klik bar untuk angka tepat.
        </p>
        {galonHarian.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={galonHarian}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="tanggal" tickFormatter={fmtTgl} fontSize={10} />
              <YAxis fontSize={10} width={35} />
              <Tooltip
                formatter={(v: any) => [`${v} galon`, "Galon"]}
                labelFormatter={(l: any) => fmtTgl(String(l))}
              />
              <Bar
                dataKey="galon"
                fill="#0ea5e9"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(d: any) =>
                  showDetail(`Galon ${fmtTgl(d.tanggal)}`, [
                    { label: "Total galon", value: `${d.galon} galon` },
                  ])
                }
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 3. Breakdown Metode Bayar */}
        <section className="bg-surface border border-line rounded-2xl p-4">
          <h2 className="font-semibold mb-1">Metode Pembayaran</h2>
          <p className="text-xs text-[color:var(--muted)] mb-3">
            Distribusi per metode. Klik slice untuk detail.
          </p>
          {metodeBayar.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={metodeBayar}
                  dataKey="total"
                  nameKey="metode"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  cursor="pointer"
                  onClick={(d: any) =>
                    showDetail(`Metode: ${String(d.metode).toUpperCase()}`, [
                      { label: "Jumlah transaksi", value: `${d.jumlah}×` },
                      { label: "Total", value: formatRupiah(d.total) },
                    ])
                  }
                  label={({ metode, percent }: any) =>
                    `${String(metode).toUpperCase()} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {metodeBayar.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any, name: any) => [
                    formatRupiah(Number(v)),
                    String(name).toUpperCase(),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* 4. Trend Pelanggan Baru */}
        <section className="bg-surface border border-line rounded-2xl p-4">
          <h2 className="font-semibold mb-1">Pelanggan Baru</h2>
          <p className="text-xs text-[color:var(--muted)] mb-3">
            Registrasi pelanggan baru per minggu.
          </p>
          {pelangganBaru.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={pelangganBaru}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="periode" fontSize={10} />
                <YAxis fontSize={10} width={30} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="jumlah"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 4, cursor: "pointer" }}
                  activeDot={{
                    r: 6,
                    onClick: (_: any, payload: any) => {
                      const d = payload?.payload;
                      if (d) {
                        showDetail(`Minggu ${d.periode}`, [
                          { label: "Pelanggan baru", value: `${d.jumlah} orang` },
                        ]);
                      }
                    },
                  }}
                  name="Pelanggan Baru"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      {/* 5. Omzet vs Pengeluaran */}
      <section className="bg-surface border border-line rounded-2xl p-4">
        <h2 className="font-semibold mb-1">Omzet vs Pengeluaran</h2>
        <p className="text-xs text-[color:var(--muted)] mb-3">
          Perbandingan harian. Hijau = omzet, merah = pengeluaran. Klik bar.
        </p>
        {omzetVsPengeluaran.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={omzetVsPengeluaran}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="tanggal" tickFormatter={fmtTgl} fontSize={10} />
              <YAxis tickFormatter={fmtRp} fontSize={10} width={50} />
              <Tooltip
                formatter={(v: any, name: any) => [
                  formatRupiah(Number(v)),
                  name === "omzet" ? "Omzet" : "Pengeluaran",
                ]}
                labelFormatter={(l: any) => fmtTgl(String(l))}
              />
              <Legend
                formatter={(v: any) => (v === "omzet" ? "Omzet" : "Pengeluaran")}
              />
              <Bar
                dataKey="omzet"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(d: any) =>
                  showDetail(`${fmtTgl(d.tanggal)}`, [
                    { label: "Omzet", value: formatRupiah(d.omzet) },
                    { label: "Pengeluaran", value: formatRupiah(d.pengeluaran) },
                    { label: "Profit", value: formatRupiah(d.omzet - d.pengeluaran) },
                  ])
                }
              />
              <Bar
                dataKey="pengeluaran"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(d: any) =>
                  showDetail(`${fmtTgl(d.tanggal)}`, [
                    { label: "Omzet", value: formatRupiah(d.omzet) },
                    { label: "Pengeluaran", value: formatRupiah(d.pengeluaran) },
                    { label: "Profit", value: formatRupiah(d.omzet - d.pengeluaran) },
                  ])
                }
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Detail popup */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-surface rounded-2xl border border-line p-5 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-extrabold text-lg mb-3">{detail.title}</div>
            <div className="space-y-2">
              {detail.rows.map((r, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-[color:var(--muted)]">{r.label}</span>
                  <span className="font-bold">{r.value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setDetail(null)}
              className="mt-4 w-full py-2 bg-brand text-white rounded-md text-sm font-bold"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="text-sm text-[color:var(--muted)] py-8 text-center">
      Belum ada data untuk periode ini.
    </div>
  );
}
