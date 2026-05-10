"use server";

import { eq, and } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/db";
import { account as accountTable } from "@/db/schema/auth";
import {
  findUserByIdentifier,
  generateOtp,
  generateToken,
  createResetToken,
  verifyResetToken,
  markResetUsed,
  sendEmailViaAppsScript,
} from "@/lib/password-reset";
import { sendWhatsApp } from "@/lib/whatsapp";

export type RequestResult =
  | { ok: true; method: "wa_otp"; userId: string; nomorHint: string }
  | { ok: true; method: "email"; emailHint: string }
  | { ok: false; needsAdmin: true; userId: string; userName: string }
  | { ok: false; error: string };

/**
 * Request reset password. Auto-detect channel:
 *   1. user.phoneNumber exists → kirim WA OTP
 *   2. user.email exists (real, bukan @phone.depot.local) → kirim email link
 *   3. neither → return needsAdmin (suruh hubungi admin)
 */
export async function requestPasswordReset(identifier: string): Promise<RequestResult> {
  const user = await findUserByIdentifier(identifier);
  if (!user) return { ok: false, error: "Akun dengan identifier itu tidak ditemukan." };

  const baseUrl = process.env.BETTER_AUTH_URL ?? "https://depot.genster.my.id";
  const appName = "Depot Air Minum";

  // 1. WhatsApp OTP
  if (user.phoneNumber && /^0\d{8,14}$/.test(user.phoneNumber)) {
    const otp = generateOtp();
    await createResetToken({ userId: user.id, method: "wa_otp", token: otp });
    const text = [
      `🔑 *${appName}* — Reset Password`,
      ``,
      `Kode OTP: *${otp}*`,
      `Berlaku 5 menit. Jangan bagikan kode ini ke siapapun.`,
      ``,
      `Kalau Anda tidak request reset password, abaikan pesan ini.`,
    ].join("\n");
    try {
      await sendWhatsApp(user.phoneNumber, text);
    } catch {
      return {
        ok: false,
        error: "Gagal kirim OTP via WhatsApp. Coba beberapa saat lagi atau hubungi admin.",
      };
    }
    const masked = user.phoneNumber.slice(0, 4) + "*****" + user.phoneNumber.slice(-3);
    return { ok: true, method: "wa_otp", userId: user.id, nomorHint: masked };
  }

  // 2. Email link
  const isPhoneEmail = user.email?.endsWith("@phone.depot.local");
  if (user.email && !isPhoneEmail) {
    const token = generateToken();
    await createResetToken({ userId: user.id, method: "email", token });
    const link = `${baseUrl}/reset-password?token=${token}`;
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color:#0c4a6e;">Reset Password — ${appName}</h2>
        <p>Halo ${user.name},</p>
        <p>Klik tombol di bawah untuk reset password Anda. Link berlaku 1 jam.</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background:#0284c7; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
            Reset Password
          </a>
        </p>
        <p style="font-size:12px; color:#666;">Atau salin URL ini:<br><code>${link}</code></p>
        <p style="font-size:12px; color:#666;">Kalau Anda tidak request reset, abaikan email ini.</p>
      </div>
    `;
    const r = await sendEmailViaAppsScript({
      to: user.email,
      subject: `Reset Password — ${appName}`,
      htmlBody: html,
    });
    if (!r.ok) {
      return {
        ok: false,
        error: `Gagal kirim email: ${r.error}. Coba lagi atau hubungi admin.`,
      };
    }
    const [name, domain] = user.email.split("@");
    const masked = name.slice(0, 2) + "***@" + domain;
    return { ok: true, method: "email", emailHint: masked };
  }

  // 3. Tidak ada channel — suruh hubungi admin
  return {
    ok: false,
    needsAdmin: true,
    userId: user.id,
    userName: user.name,
  };
}

/**
 * Verify OTP/token + reset password.
 */
export async function verifyAndResetPassword(args: {
  token: string;
  userId?: string;
  newPassword: string;
}): Promise<{ ok: true } | { error: string }> {
  if (args.newPassword.length < 8) {
    return { error: "Password minimal 8 karakter" };
  }

  const v = await verifyResetToken({ token: args.token, userId: args.userId });
  if (!v.ok) return { error: v.error };

  // Hash password pakai utility Better Auth supaya format match dengan
  // login flow (scrypt). Update langsung ke account.password.
  const hashed = await hashPassword(args.newPassword);

  // Cari credential account user
  const cred = await db.query.account.findFirst({
    where: and(
      eq(accountTable.userId, v.record.userId),
      eq(accountTable.providerId, "credential"),
    ),
  });

  if (cred) {
    await db
      .update(accountTable)
      .set({ password: hashed, updatedAt: new Date() })
      .where(eq(accountTable.id, cred.id));
  } else {
    // User belum punya credential account (mungkin daftar via OTP only).
    // Buat baru.
    await db.insert(accountTable).values({
      id: crypto.randomUUID(),
      userId: v.record.userId,
      accountId: v.record.userId,
      providerId: "credential",
      password: hashed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  await markResetUsed(v.record.id);
  return { ok: true };
}
