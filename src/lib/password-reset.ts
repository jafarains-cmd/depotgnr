import { eq, and } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { passwordReset } from "@/db/schema/password-reset";
import { user as userTable } from "@/db/schema/auth";
import { pengaturan } from "@/db/schema/pengaturan";

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 menit
const LINK_EXPIRY_MS = 60 * 60 * 1000; // 1 jam (email)
const ADMIN_LINK_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 jam (admin manual)

export type ResetMethod = "wa_otp" | "email" | "admin";

/**
 * Generate 6-digit OTP code (untuk WhatsApp).
 */
export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Generate token aman untuk link reset (URL-safe hex 32 char).
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Cari user by identifier — bisa email, username, atau nomor HP (08xx).
 * Phone normalisasi sederhana: kalau diawali 0 → biarkan, kalau diawali +62 atau 62 → ganti 0.
 */
export async function findUserByIdentifier(raw: string) {
  const id = raw.trim();
  if (!id) return null;

  // Cek email
  if (id.includes("@")) {
    const u = await db.query.user.findFirst({ where: eq(userTable.email, id.toLowerCase()) });
    if (u) return u;
  }

  // Cek username (case-insensitive lewat lowercase)
  const lower = id.toLowerCase();
  const byUsername = await db.query.user.findFirst({
    where: eq(userTable.username, lower),
  });
  if (byUsername) return byUsername;

  // Cek phone — normalize
  let phone = id.replace(/[\s-]/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("62")) phone = "0" + phone.slice(2);
  if (phone.startsWith("8")) phone = "0" + phone;
  phone = phone.replace(/\D/g, "");
  if (/^0\d{8,14}$/.test(phone)) {
    const byPhone = await db.query.user.findFirst({
      where: eq(userTable.phoneNumber, phone),
    });
    if (byPhone) return byPhone;
  }

  return null;
}

/**
 * Insert reset token + return record.
 */
export async function createResetToken(args: {
  userId: string;
  method: ResetMethod;
  token: string;
  createdByUserId?: string;
}) {
  const expiryMs =
    args.method === "wa_otp"
      ? OTP_EXPIRY_MS
      : args.method === "email"
        ? LINK_EXPIRY_MS
        : ADMIN_LINK_EXPIRY_MS;
  const expiresAt = new Date(Date.now() + expiryMs);

  await db.insert(passwordReset).values({
    userId: args.userId,
    method: args.method,
    token: args.token,
    expiresAt,
    createdByUserId: args.createdByUserId ?? null,
  });

  return { expiresAt };
}

/**
 * Verify token (atau OTP). Return reset record kalau valid + masih bisa dipakai.
 */
export async function verifyResetToken(args: {
  token: string;
  userId?: string; // wajib untuk method=wa_otp (OTP tidak unique cross-user)
}) {
  const record = await db.query.passwordReset.findFirst({
    where: args.userId
      ? and(eq(passwordReset.token, args.token), eq(passwordReset.userId, args.userId))
      : eq(passwordReset.token, args.token),
  });
  if (!record) return { ok: false as const, error: "Token tidak valid" };
  if (record.usedAt) return { ok: false as const, error: "Token sudah dipakai" };
  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "Token expired. Mohon request ulang." };
  }
  return { ok: true as const, record };
}

/**
 * Mark token used setelah berhasil reset.
 */
export async function markResetUsed(id: number) {
  await db.update(passwordReset).set({ usedAt: new Date() }).where(eq(passwordReset.id, id));
}

/**
 * Kirim email via Apps Script (op=sendEmail).
 */
export async function sendEmailViaAppsScript(args: {
  to: string;
  subject: string;
  htmlBody: string;
}): Promise<{ ok: boolean; error?: string }> {
  const cfgRows = await db.query.pengaturan.findMany();
  const cfg = Object.fromEntries(cfgRows.map((r) => [r.key, r.value ?? ""]));
  const url = cfg.appsScriptUrl;
  const token = cfg.appsScriptToken;
  if (!url || !token) return { ok: false, error: "Apps Script belum diset" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        op: "sendEmail",
        to: args.to,
        subject: args.subject,
        htmlBody: args.htmlBody,
      }),
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as { ok: boolean; error?: string };
    return json;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
