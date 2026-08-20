import { createHash } from "node:crypto";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginEvent } from "@/db/schema/login-event";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { sendWhatsApp } from "./whatsapp";
import { sendTelegram } from "./telegram";
import { bestEffort } from "./best-effort";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hash IP + User-Agent jadi fingerprint pendek untuk quick lookup "device baru".
 * Bukan crypto secret, cuma untuk grouping. SHA-256 dipendekkan ke 16 char.
 */
export function computeFingerprint(ip: string | null, ua: string | null): string {
  const raw = `${ip ?? "-"}|${ua ?? "-"}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

/**
 * Log event login (success / failed / rate_limited).
 * Best-effort — kalau DB error, tidak throw (jangan block login flow).
 */
export async function logLoginEvent(args: {
  userId?: string | null;
  identifier: string;
  status: "success" | "failed" | "rate_limited";
  ipAddress?: string | null;
  userAgent?: string | null;
  failReason?: string | null;
}): Promise<void> {
  try {
    const fingerprint = computeFingerprint(args.ipAddress ?? null, args.userAgent ?? null);
    await db.insert(loginEvent).values({
      userId: args.userId ?? null,
      identifier: args.identifier.toLowerCase().slice(0, 200),
      status: args.status,
      ipAddress: args.ipAddress ?? null,
      userAgent: args.userAgent?.slice(0, 500) ?? null,
      fingerprint,
      failReason: args.failReason ?? null,
    });
  } catch {
    // silent fail — jangan ganggu login flow
  }
}

/**
 * Cek apakah device (fingerprint) ini baru untuk user tertentu.
 * "Baru" = fingerprint tidak pernah muncul di login sukses user ini
 * dalam 90 hari terakhir.
 */
export async function isNewDevice(userId: string, fingerprint: string): Promise<boolean> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * DAY_MS);
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(loginEvent)
    .where(
      and(
        eq(loginEvent.userId, userId),
        eq(loginEvent.status, "success"),
        eq(loginEvent.fingerprint, fingerprint),
        gte(loginEvent.createdAt, ninetyDaysAgo),
      ),
    );
  // > 1 karena login yang baru saja tercatat juga hitung. Kalau cuma 1 (yang baru saja) = memang baru.
  return Number(row?.n ?? 0) <= 1;
}

/**
 * Kirim notifikasi login dari device baru ke user (via WA/Telegram).
 * Best-effort.
 */
export async function notifyNewDeviceLogin(args: {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
}): Promise<void> {
  try {
    const u = await db.query.user.findFirst({
      where: eq(userTable.id, args.userId),
    });
    if (!u) return;

    // Kalau role staff, kirim ke nomor mereka. Kalau pelanggan, cari telp di pelanggan.
    const jam = args.timestamp.toLocaleString("id-ID", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    const deviceLabel = shortDeviceLabel(args.userAgent);
    const ipLabel = args.ipAddress ?? "unknown";

    const text = [
      `🔐 *Login baru terdeteksi*`,
      ``,
      `Akun: ${u.name} (${u.role})`,
      `Waktu: ${jam}`,
      `Device: ${deviceLabel}`,
      `IP: ${ipLabel}`,
      ``,
      `Kalau ini BUKAN Anda, segera ganti password di /akun.`,
    ].join("\n");

    // Cari kontak: kalau pelanggan → dari tabel pelanggan.telp
    // kalau staff → dari pelanggan.telp juga (asumsi staff terdaftar sbg pelanggan)
    // atau user.telegramChatId
    if (u.telegramChatId) {
      bestEffort("notifyNewDeviceLogin-telegram", sendTelegram(u.telegramChatId, text));
    }

    // Cari WA via tabel pelanggan (linked by userId)
    const pel = await db.query.pelanggan.findFirst({
      where: eq(pelangganTable.userId, args.userId),
    });
    if (pel?.telp) {
      bestEffort("notifyNewDeviceLogin-wa", sendWhatsApp(pel.telp, text));
    }
  } catch {
    // silent — jangan block
  }
}

/**
 * Convert User-Agent panjang ke label pendek yang mudah dibaca.
 */
function shortDeviceLabel(ua: string | null): string {
  if (!ua) return "Unknown";
  if (/Android/i.test(ua)) {
    if (/Chrome/i.test(ua)) return "Android (Chrome)";
    return "Android";
  }
  if (/iPhone|iPad|iOS/i.test(ua)) {
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "iOS (Safari)";
    return "iOS";
  }
  if (/Windows/i.test(ua)) {
    if (/Chrome/i.test(ua)) return "Windows (Chrome)";
    if (/Firefox/i.test(ua)) return "Windows (Firefox)";
    if (/Edg/i.test(ua)) return "Windows (Edge)";
    return "Windows";
  }
  if (/Mac/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

/**
 * Extract IP dari request headers (support Cloudflare + standar proxy).
 */
export function extractIp(headers: Headers): string | null {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null
  );
}

/**
 * Track full login pipeline: log event + cek device baru + notify.
 * Dipanggil setelah login sukses.
 */
export async function trackLoginSuccess(args: {
  userId: string;
  identifier: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<void> {
  const fingerprint = computeFingerprint(args.ipAddress, args.userAgent);
  await logLoginEvent({
    userId: args.userId,
    identifier: args.identifier,
    status: "success",
    ipAddress: args.ipAddress,
    userAgent: args.userAgent,
  });

  // Cek device baru (setelah log entry masuk)
  const isNew = await isNewDevice(args.userId, fingerprint);
  if (isNew) {
    bestEffort(
      "notifyNewDeviceLogin",
      notifyNewDeviceLogin({
        userId: args.userId,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        timestamp: new Date(),
      }),
    );
  }
}

/**
 * Stat login events untuk security dashboard.
 */
export async function getLoginStats(): Promise<{
  totalSuccess7d: number;
  totalFailed7d: number;
  totalRateLimited7d: number;
  topFailedIdentifiers: Array<{ identifier: string; count: number }>;
  recentFailed: Array<{
    id: number;
    identifier: string;
    ipAddress: string | null;
    createdAt: Date;
    failReason: string | null;
  }>;
  suspiciousIPs: Array<{ ipAddress: string; failCount: number }>;
}> {
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);

  const [successRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(loginEvent)
    .where(
      and(eq(loginEvent.status, "success"), gte(loginEvent.createdAt, sevenDaysAgo)),
    );

  const [failedRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(loginEvent)
    .where(
      and(eq(loginEvent.status, "failed"), gte(loginEvent.createdAt, sevenDaysAgo)),
    );

  const [rlRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(loginEvent)
    .where(
      and(
        eq(loginEvent.status, "rate_limited"),
        gte(loginEvent.createdAt, sevenDaysAgo),
      ),
    );

  const topFailed = await db
    .select({
      identifier: loginEvent.identifier,
      count: sql<number>`count(*)`,
    })
    .from(loginEvent)
    .where(
      and(eq(loginEvent.status, "failed"), gte(loginEvent.createdAt, sevenDaysAgo)),
    )
    .groupBy(loginEvent.identifier)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  const recentFailed = await db
    .select({
      id: loginEvent.id,
      identifier: loginEvent.identifier,
      ipAddress: loginEvent.ipAddress,
      createdAt: loginEvent.createdAt,
      failReason: loginEvent.failReason,
    })
    .from(loginEvent)
    .where(eq(loginEvent.status, "failed"))
    .orderBy(desc(loginEvent.createdAt))
    .limit(10);

  // IP dengan > 10 failed dalam 7 hari = suspicious
  const suspiciousRaw = await db
    .select({
      ipAddress: loginEvent.ipAddress,
      failCount: sql<number>`count(*)`,
    })
    .from(loginEvent)
    .where(
      and(eq(loginEvent.status, "failed"), gte(loginEvent.createdAt, sevenDaysAgo)),
    )
    .groupBy(loginEvent.ipAddress)
    .having(sql`count(*) >= 10`)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return {
    totalSuccess7d: Number(successRow?.n ?? 0),
    totalFailed7d: Number(failedRow?.n ?? 0),
    totalRateLimited7d: Number(rlRow?.n ?? 0),
    topFailedIdentifiers: topFailed.map((r) => ({
      identifier: r.identifier,
      count: Number(r.count),
    })),
    recentFailed,
    suspiciousIPs: suspiciousRaw
      .filter((r) => r.ipAddress !== null)
      .map((r) => ({
        ipAddress: r.ipAddress as string,
        failCount: Number(r.failCount),
      })),
  };
}
