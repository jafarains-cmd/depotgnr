import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, username, phoneNumber } from "better-auth/plugins";
import { db, schema } from "@/db";
import { sendWhatsApp } from "./whatsapp";

export const auth = betterAuth({
  appName: "Depot Air Minum",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  // Session TTL panjang supaya pelanggan/staff tidak sering logout.
  // - expiresIn 90 hari: kalau tidak buka app 3 bulan, baru logout
  // - updateAge 7 hari: session auto-extend seminggu sekali saat ada request
  // - freshAge 0: skip re-authentication requirement untuk aksi sensitif
  session: {
    expiresIn: 60 * 60 * 24 * 90, // 90 hari
    updateAge: 60 * 60 * 24 * 7, // refresh mingguan
    freshAge: 0,
  },
  // Cookie config: persistent 90 hari (bukan session-only) supaya cookie
  // tidak hilang saat browser tutup. sameSite lax = default Better Auth
  // (aman untuk form action + navigasi normal).
  advanced: {
    defaultCookieAttributes: {
      maxAge: 60 * 60 * 24 * 90, // 90 hari persistent
      sameSite: "lax",
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "pelanggan",
        input: false,
      },
      alamat: { type: "string", required: false },
      telegramChatId: { type: "string", required: false },
    },
  },
  plugins: [
    username(),
    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        const tpl = `Kode OTP Depot Air: *${code}*\nBerlaku 5 menit. Jangan bagikan kode ini.`;
        await sendWhatsApp(phoneNumber, tpl);
      },
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone}@phone.depot.local`,
        getTempName: (phone) => phone,
      },
    }),
    admin({
      defaultRole: "pelanggan",
      adminRoles: ["admin"],
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
