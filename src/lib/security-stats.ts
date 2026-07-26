import { sql, eq, and, gte, desc, isNull, ne } from "drizzle-orm";
import { statSync } from "node:fs";
import { db } from "@/db";
import { user as userTable, session as sessionTable } from "@/db/schema/auth";
import { auditLog } from "@/db/schema/audit";
import { backupLog } from "@/db/schema/backup";
import { shiftKasir } from "@/db/schema/shift";
import { orderHeader } from "@/db/schema/order";
import { pengeluaran } from "@/db/schema/pengeluaran";
import { transaksi } from "@/db/schema/transaksi";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type HealthStat = {
  status: "ok" | "warning" | "critical";
  message: string;
};

export type SecurityHealth = {
  backup: HealthStat & {
    lastRunAt: Date | null;
    lastStatus: string | null;
    sizeBytes: number | null;
    ageHours: number | null;
  };
  database: HealthStat & { sizeMB: number | null; path: string };
  uptime: { seconds: number; formatted: string };
  runtime: { nodeVersion: string; platform: string; arch: string };
  session: {
    active: number;
    expired24h: number;
  };
};

export type UserStat = {
  perRole: Array<{ role: string; count: number; banned: number }>;
  activeSessions: Array<{
    userName: string;
    userId: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    expiresAt: Date;
  }>;
  neverLoggedIn30d: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date;
  }>;
  admins: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: Date;
  }>;
};

export type AnomalyItem = {
  jenis: string;
  severity: "info" | "warning" | "critical";
  label: string;
  detail: string;
  href?: string;
};

export type AuditStat = {
  total7d: number;
  perAction: Array<{ action: string; count: number }>;
  topActors: Array<{ userId: string | null; name: string | null; count: number }>;
  recent: Array<{
    id: number;
    action: string;
    entity: string;
    entityId: string | null;
    actorName: string | null;
    createdAt: Date;
  }>;
};

export type EnvCheck = {
  publicVars: Array<{ name: string; suspicious: boolean }>;
  criticalConfigured: {
    BETTER_AUTH_SECRET: boolean;
    DATABASE_URL: boolean;
  };
  optionalConfigured: {
    TELEGRAM_BOT_TOKEN: boolean;
    GOOGLE_DRIVE_SCRIPT_URL: boolean;
  };
};

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}h ${h}j ${m}m`;
  if (h > 0) return `${h}j ${m}m`;
  return `${m} menit`;
}

export async function getSecurityHealth(): Promise<SecurityHealth> {
  const now = Date.now();

  // Backup — ambil yang terakhir
  const [lastBackup] = await db
    .select()
    .from(backupLog)
    .orderBy(desc(backupLog.ranAt))
    .limit(1);

  const backupAgeHours = lastBackup
    ? (now - lastBackup.ranAt.getTime()) / HOUR_MS
    : null;

  let backupStatus: HealthStat = { status: "ok", message: "Sehat" };
  if (!lastBackup) {
    backupStatus = { status: "critical", message: "Belum pernah backup" };
  } else if (lastBackup.status === "failed") {
    backupStatus = { status: "critical", message: "Backup terakhir GAGAL" };
  } else if (backupAgeHours && backupAgeHours > 48) {
    backupStatus = { status: "warning", message: `Backup tertua > 48 jam` };
  } else if (backupAgeHours && backupAgeHours > 24) {
    backupStatus = { status: "warning", message: `Belum backup 24 jam` };
  }

  // Database size
  const dbPath = process.env.DATABASE_URL ?? "./data/depot.db";
  let sizeMB: number | null = null;
  try {
    const stat = statSync(dbPath);
    sizeMB = Math.round((stat.size / 1024 / 1024) * 100) / 100;
  } catch {
    sizeMB = null;
  }

  let dbStatus: HealthStat = { status: "ok", message: "Sehat" };
  if (sizeMB === null) {
    dbStatus = { status: "warning", message: "Tidak bisa cek ukuran" };
  } else if (sizeMB > 500) {
    dbStatus = { status: "warning", message: "Ukuran > 500 MB" };
  }

  // Session
  const [activeSess] = await db
    .select({ n: sql<number>`count(*)` })
    .from(sessionTable)
    .where(gte(sessionTable.expiresAt, new Date()));

  const [expiredSess] = await db
    .select({ n: sql<number>`count(*)` })
    .from(sessionTable)
    .where(
      and(
        gte(sessionTable.updatedAt, new Date(now - DAY_MS)),
        sql`${sessionTable.expiresAt} < CURRENT_TIMESTAMP`,
      ),
    );

  return {
    backup: {
      ...backupStatus,
      lastRunAt: lastBackup?.ranAt ?? null,
      lastStatus: lastBackup?.status ?? null,
      sizeBytes: lastBackup?.sizeBytes ?? null,
      ageHours: backupAgeHours,
    },
    database: {
      ...dbStatus,
      sizeMB,
      path: dbPath,
    },
    uptime: {
      seconds: Math.floor(process.uptime()),
      formatted: fmtUptime(Math.floor(process.uptime())),
    },
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    session: {
      active: Number(activeSess?.n ?? 0),
      expired24h: Number(expiredSess?.n ?? 0),
    },
  };
}

export async function getUserStat(): Promise<UserStat> {
  const perRoleRaw = await db
    .select({
      role: userTable.role,
      count: sql<number>`count(*)`,
      banned: sql<number>`sum(case when ${userTable.banned} = 1 then 1 else 0 end)`,
    })
    .from(userTable)
    .groupBy(userTable.role);

  const activeSessRaw = await db
    .select({
      userId: sessionTable.userId,
      userName: userTable.name,
      ipAddress: sessionTable.ipAddress,
      userAgent: sessionTable.userAgent,
      createdAt: sessionTable.createdAt,
      expiresAt: sessionTable.expiresAt,
    })
    .from(sessionTable)
    .leftJoin(userTable, eq(sessionTable.userId, userTable.id))
    .where(gte(sessionTable.expiresAt, new Date()))
    .orderBy(desc(sessionTable.updatedAt))
    .limit(20);

  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS);
  const staleUsers = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .leftJoin(sessionTable, eq(sessionTable.userId, userTable.id))
    .where(
      and(
        ne(userTable.role, "pelanggan"),
        isNull(sessionTable.id),
        gte(userTable.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(userTable.id)
    .limit(20);

  const admins = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .where(eq(userTable.role, "admin"));

  return {
    perRole: perRoleRaw.map((r) => ({
      role: r.role,
      count: Number(r.count),
      banned: Number(r.banned ?? 0),
    })),
    activeSessions: activeSessRaw.map((s) => ({
      userName: s.userName ?? "—",
      userId: s.userId,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    })),
    neverLoggedIn30d: staleUsers,
    admins,
  };
}

export async function getAnomalies(): Promise<AnomalyItem[]> {
  const now = Date.now();
  const anomalies: AnomalyItem[] = [];

  // Shift dengan selisih > 50rb (belum ter-explain)
  const shiftSelisih = await db
    .select({
      id: shiftKasir.id,
      kasirNama: userTable.name,
      selisih: shiftKasir.selisih,
      selisihKategori: shiftKasir.selisihKategori,
      closedAt: shiftKasir.closedAt,
    })
    .from(shiftKasir)
    .leftJoin(userTable, eq(shiftKasir.kasirUserId, userTable.id))
    .where(
      and(
        eq(shiftKasir.status, "closed"),
        sql`abs(${shiftKasir.selisih}) > 50000`,
      ),
    )
    .orderBy(desc(shiftKasir.closedAt))
    .limit(5);

  for (const s of shiftSelisih) {
    const explained = s.selisihKategori !== null;
    anomalies.push({
      jenis: "shift-selisih-besar",
      severity: explained ? "warning" : "critical",
      label: `Shift ${s.kasirNama} selisih ${(s.selisih ?? 0) > 0 ? "+" : ""}Rp ${Math.abs(s.selisih ?? 0).toLocaleString("id-ID")}`,
      detail: explained
        ? `Kategori: ${s.selisihKategori}. Tanggal ${s.closedAt?.toLocaleDateString("id-ID")}`
        : `BELUM DIJELASKAN. Tanggal ${s.closedAt?.toLocaleDateString("id-ID")}`,
      href: "/admin/shift",
    });
  }

  // Shift lupa tutup > 24 jam
  const staleOpenShifts = await db
    .select({
      id: shiftKasir.id,
      kasirNama: userTable.name,
      openedAt: shiftKasir.openedAt,
    })
    .from(shiftKasir)
    .leftJoin(userTable, eq(shiftKasir.kasirUserId, userTable.id))
    .where(
      and(
        eq(shiftKasir.status, "open"),
        sql`${shiftKasir.openedAt} < ${new Date(now - DAY_MS).toISOString()}`,
      ),
    )
    .limit(5);

  for (const s of staleOpenShifts) {
    const hours = Math.floor((now - s.openedAt.getTime()) / HOUR_MS);
    anomalies.push({
      jenis: "shift-lupa-tutup",
      severity: hours > 48 ? "critical" : "warning",
      label: `Shift ${s.kasirNama} lupa tutup ${hours} jam`,
      detail: `Dibuka ${s.openedAt.toLocaleString("id-ID")}. Admin harus force-close.`,
      href: "/admin/shift",
    });
  }

  // Pengeluaran > 500rb tanpa foto bukti
  const bigNoPhoto = await db
    .select({
      id: pengeluaran.id,
      jumlah: pengeluaran.jumlah,
      kategori: pengeluaran.kategori,
      tanggal: pengeluaran.tanggal,
    })
    .from(pengeluaran)
    .where(
      and(
        sql`${pengeluaran.jumlah} > 500000`,
        isNull(pengeluaran.fotoNotaUrl),
        gte(pengeluaran.tanggal, new Date(now - 30 * DAY_MS)),
      ),
    )
    .limit(5);

  for (const p of bigNoPhoto) {
    anomalies.push({
      jenis: "pengeluaran-besar-tanpa-foto",
      severity: "warning",
      label: `Pengeluaran ${p.kategori} Rp ${p.jumlah.toLocaleString("id-ID")} tanpa foto`,
      detail: `${p.tanggal.toLocaleDateString("id-ID")}. Tambahkan foto nota untuk audit trail.`,
      href: "/admin/pengeluaran",
    });
  }

  // Piutang > 30 hari (aging)
  const [pOverdueRow] = await db
    .select({
      n: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${orderHeader.totalEstimasi} - ${orderHeader.paidPartial}), 0)`,
    })
    .from(orderHeader)
    .where(
      and(
        eq(orderHeader.status, "selesai"),
        eq(orderHeader.statusBayar, "belum"),
        sql`${orderHeader.createdAt} < ${new Date(now - 30 * DAY_MS).toISOString()}`,
      ),
    );

  const overdueCount = Number(pOverdueRow?.n ?? 0);
  const overdueTotal = Number(pOverdueRow?.total ?? 0);
  if (overdueCount > 0) {
    anomalies.push({
      jenis: "piutang-menua",
      severity: overdueTotal > 500000 ? "critical" : "warning",
      label: `${overdueCount} piutang menua > 30 hari (Rp ${overdueTotal.toLocaleString("id-ID")})`,
      detail: "Follow-up ke pelanggan atau tulis-off kalau tidak tertagih.",
      href: "/pembayaran",
    });
  }

  // Transaksi total Rp 0 tanpa loyalti refund (data lama / manipulasi?)
  const [zeroTrx] = await db
    .select({ n: sql<number>`count(*)` })
    .from(transaksi)
    .where(
      and(
        eq(transaksi.total, 0),
        eq(transaksi.diskon, 0),
        isNull(transaksi.voidedAt),
        gte(transaksi.createdAt, new Date(now - 30 * DAY_MS)),
      ),
    );

  const zeroCount = Number(zeroTrx?.n ?? 0);
  if (zeroCount > 0) {
    anomalies.push({
      jenis: "transaksi-rp0",
      severity: "info",
      label: `${zeroCount} transaksi Rp 0 (tanpa field diskon)`,
      detail:
        "Kemungkinan pakai loyalti pelanggan atau data lama sebelum diskon di-track. Detail cek di modal transaksi.",
      href: "/kasir/transaksi",
    });
  }

  // Stok terisi rendah (di bawah threshold produk)
  const { getStokRendah, getPelangganPinjamMacet } = await import("./stok-alert");
  const stokRendah = await getStokRendah();
  for (const s of stokRendah) {
    const displayName = s.brand ? `${s.nama} (${s.brand})` : s.nama;
    anomalies.push({
      jenis: "stok-terisi-rendah",
      severity: s.stokTerisi === 0 ? "critical" : "warning",
      label: `Stok ${displayName}: ${s.stokTerisi} galon (min ${s.stokMinimal})`,
      detail:
        s.stokTerisi === 0
          ? `HABIS — waktu produksi/isi ulang dari tong sekarang!`
          : `Kekurangan ${s.kekurangan} galon dari minimum. Segera produksi/isi ulang.`,
      href: "/admin/inventory",
    });
  }

  // Pelanggan pinjam galon tapi tidak order > 30 hari
  const pinjamMacet = await getPelangganPinjamMacet();
  if (pinjamMacet.length > 0) {
    const totalGalonMacet = pinjamMacet.reduce((s, p) => s + p.totalGalon, 0);
    anomalies.push({
      jenis: "pinjam-galon-macet",
      severity: pinjamMacet.length >= 5 ? "critical" : "warning",
      label: `${pinjamMacet.length} pelanggan pinjam galon tapi tidak order > 30 hari (${totalGalonMacet} galon)`,
      detail: `Kandidat follow-up: ${pinjamMacet.slice(0, 3).map((p) => p.nama).join(", ")}${pinjamMacet.length > 3 ? "..." : ""}. Galon berisiko hilang atau pelanggan tidak aktif lagi.`,
      href: "/admin/galon-dipinjam",
    });
  }

  return anomalies;
}

export async function getAuditStat(): Promise<AuditStat> {
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);

  const [totalRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(auditLog)
    .where(gte(auditLog.createdAt, sevenDaysAgo));

  const perAction = await db
    .select({
      action: auditLog.action,
      count: sql<number>`count(*)`,
    })
    .from(auditLog)
    .where(gte(auditLog.createdAt, sevenDaysAgo))
    .groupBy(auditLog.action)
    .orderBy(desc(sql`count(*)`))
    .limit(15);

  const topActorsRaw = await db
    .select({
      userId: auditLog.actorUserId,
      name: userTable.name,
      count: sql<number>`count(*)`,
    })
    .from(auditLog)
    .leftJoin(userTable, eq(auditLog.actorUserId, userTable.id))
    .where(gte(auditLog.createdAt, sevenDaysAgo))
    .groupBy(auditLog.actorUserId)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  const recent = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      actorName: userTable.name,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(userTable, eq(auditLog.actorUserId, userTable.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(15);

  return {
    total7d: Number(totalRow?.n ?? 0),
    perAction: perAction.map((r) => ({ action: r.action, count: Number(r.count) })),
    topActors: topActorsRaw.map((r) => ({
      userId: r.userId,
      name: r.name,
      count: Number(r.count),
    })),
    recent,
  };
}

/**
 * Cek env var. NEXT_PUBLIC_* di-bundle ke client — jangan sampai isi secret.
 * Suspicious kalau namanya mengandung SECRET/KEY/TOKEN/PASSWORD.
 */
export function getEnvCheck(): EnvCheck {
  const suspiciousPattern = /(secret|key|token|password|api_key)/i;
  const publicVars = Object.keys(process.env)
    .filter((k) => k.startsWith("NEXT_PUBLIC_"))
    .map((name) => ({
      name,
      suspicious: suspiciousPattern.test(name),
    }));

  return {
    publicVars,
    criticalConfigured: {
      BETTER_AUTH_SECRET: !!process.env.BETTER_AUTH_SECRET,
      DATABASE_URL: !!process.env.DATABASE_URL || true, // fallback path always
    },
    optionalConfigured: {
      TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
      GOOGLE_DRIVE_SCRIPT_URL: !!process.env.GOOGLE_DRIVE_SCRIPT_URL,
    },
  };
}
