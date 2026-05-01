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
