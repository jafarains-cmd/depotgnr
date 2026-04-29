import { Bot, type Context } from "grammy";
import { eq, and, desc, ne } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { chatSession, pengaturan } from "@/db/schema/pengaturan";
import { orderHeader } from "@/db/schema/order";
import { pelanggan } from "@/db/schema/pelanggan";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let _bot: Bot | null = null;

export function getBot(): Bot | null {
  if (!TOKEN) return null;
  if (_bot) return _bot;
  _bot = new Bot(TOKEN);
  registerHandlers(_bot);
  return _bot;
}

export async function sendTelegram(
  chatId: string | number,
  text: string,
  options?: { messageThreadId?: number | string },
): Promise<void> {
  if (!TOKEN) {
    console.log(`[telegram:dev] -> ${chatId}${options?.messageThreadId ? "#" + options.messageThreadId : ""}: ${text}`);
    return;
  }
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
  };
  if (options?.messageThreadId) {
    body.message_thread_id = Number(options.messageThreadId);
  }
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Telegram error ${res.status}: ${await res.text()}`);
}

export async function notifAdminTelegram(text: string): Promise<void> {
  const ids = (process.env.ADMIN_TELEGRAM_CHAT_ID ?? "").split(",").filter(Boolean);
  await Promise.all(ids.map((id) => sendTelegram(id.trim(), text).catch((e) => console.warn(e))));
}

/**
 * Status order yang punya topic terpisah di grup.
 */
export type OrderTopicKey =
  | "pending"
  | "diproses"
  | "dijemput"
  | "diisi"
  | "diantar"
  | "selesai"
  | "batal";

const TOPIC_KEY_MAP: Record<OrderTopicKey, string> = {
  pending: "telegramTopicPending",
  diproses: "telegramTopicDiproses",
  dijemput: "telegramTopicDiproses", // share topic dengan diproses
  diisi: "telegramTopicDiproses",
  diantar: "telegramTopicDiantar",
  selesai: "telegramTopicSelesai",
  batal: "telegramTopicBatal",
};

/**
 * Kirim notif order ke grup Telegram (kalau dikonfigurasi):
 *  - selalu post ke topic "Semua Orderan"
 *  - juga post ke topic spesifik status (pending/diproses/diantar/selesai/batal)
 *
 * Kalau grup tidak diset di pengaturan → fallback ke notifAdminTelegram (DM admin).
 */
export async function notifGrupOrder(status: OrderTopicKey, text: string): Promise<void> {
  const groupChatRow = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, "telegramGroupChatId"),
  });
  const groupChatId = groupChatRow?.value?.trim();

  if (!groupChatId) {
    // Fallback: kirim ke DM admin lewat env
    await notifAdminTelegram(text);
    return;
  }

  // Ambil topic IDs (semua + status spesifik)
  const semuaRow = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, "telegramTopicSemua"),
  });
  const statusRow = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, TOPIC_KEY_MAP[status]),
  });

  const semuaThread = semuaRow?.value?.trim();
  const statusThread = statusRow?.value?.trim();

  const tasks: Promise<void>[] = [];
  // Selalu kirim ke "semua"
  tasks.push(
    sendTelegram(groupChatId, text, semuaThread ? { messageThreadId: semuaThread } : undefined).catch(
      (e) => console.warn("[telegram] grup-semua:", e),
    ),
  );
  // Kirim ke topic status (kalau berbeda dari "semua" supaya tidak dobel)
  if (statusThread && statusThread !== semuaThread) {
    tasks.push(
      sendTelegram(groupChatId, text, { messageThreadId: statusThread }).catch((e) =>
        console.warn(`[telegram] grup-${status}:`, e),
      ),
    );
  }
  await Promise.all(tasks);
}

/**
 * Buat kode linking (6 digit acak), simpan di chatSession dengan
 * chatId placeholder `pending-{code}` agar bot bisa cari saat /start <code>.
 */
export async function createTelegramLinkCode(userId: string): Promise<string> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await db.insert(chatSession).values({
    channel: "telegram",
    chatId: `pending-${code}`,
    state: `link:${userId}`,
    data: JSON.stringify({ expiresAt: Date.now() + 10 * 60 * 1000 }),
  });
  return code;
}

function registerHandlers(bot: Bot) {
  bot.command("start", async (ctx) => {
    const arg = ctx.match.trim();
    const tgChatId = String(ctx.chat?.id ?? "");
    if (!tgChatId) return;

    if (arg) {
      // Linking flow: /start <code>
      const pending = await db.query.chatSession.findFirst({
        where: and(eq(chatSession.channel, "telegram"), eq(chatSession.chatId, `pending-${arg}`)),
      });
      if (!pending) {
        return ctx.reply("Kode tidak valid atau sudah kadaluarsa.");
      }
      const userId = pending.state.replace(/^link:/, "");
      const expiresAt = (() => {
        try {
          return JSON.parse(pending.data ?? "{}").expiresAt as number | undefined;
        } catch {
          return undefined;
        }
      })();
      if (expiresAt && Date.now() > expiresAt) {
        await db.delete(chatSession).where(eq(chatSession.id, pending.id));
        return ctx.reply("Kode sudah kadaluarsa. Generate ulang dari aplikasi.");
      }

      await db.update(userTable).set({ telegramChatId: tgChatId }).where(eq(userTable.id, userId));
      await db.delete(chatSession).where(eq(chatSession.id, pending.id));

      const u = await db.query.user.findFirst({ where: eq(userTable.id, userId) });
      return ctx.reply(
        `✅ Akun *${u?.name ?? ""}* berhasil terhubung.\n\nKetik /status untuk cek order, atau /help untuk bantuan.`,
        { parse_mode: "Markdown" },
      );
    }

    return ctx.reply(
      "Selamat datang di *Depot Air Minum*!\n\nUntuk mulai, hubungkan akun Anda dengan masuk ke web → Profil → Hubungkan Telegram, lalu kirim kode-nya ke sini sebagai:\n\n`/start KODE`\n\nKetik /help untuk daftar perintah.",
      { parse_mode: "Markdown" },
    );
  });

  bot.command("help", (ctx) =>
    ctx.reply(
      "*Perintah*\n" +
        "/start KODE - hubungkan akun\n" +
        "/status - cek order aktif\n" +
        "/order - panduan order baru\n" +
        "/chatid - tampilkan ID chat ini (untuk admin)\n" +
        "/topicid - tampilkan ID topic ini (untuk admin)\n" +
        "/help - bantuan",
      { parse_mode: "Markdown" },
    ),
  );

  bot.command("chatid", (ctx) => {
    const id = ctx.chat?.id;
    const type = ctx.chat?.type;
    return ctx.reply(`Chat ID: \`${id}\`\nType: ${type}`, { parse_mode: "Markdown" });
  });

  bot.command("topicid", (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    if (!threadId) {
      return ctx.reply(
        "Pesan ini bukan di topic. Kirim /topicid di dalam topic spesifik (forum/topics aktif di grup).",
      );
    }
    return ctx.reply(`Topic ID: \`${threadId}\``, { parse_mode: "Markdown" });
  });

  bot.command("order", async (ctx) => {
    const url = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    return ctx.reply(
      `Untuk order, buka:\n${url}/pelanggan/order-baru\n\nAtau hubungi admin lewat WhatsApp.`,
    );
  });

  bot.command("status", async (ctx) => {
    const tgChatId = String(ctx.chat?.id ?? "");
    const u = await db.query.user.findFirst({
      where: eq(userTable.telegramChatId, tgChatId),
    });
    if (!u) return ctx.reply("Akun belum terhubung. Kirim /start KODE terlebih dahulu.");

    const pel = await db.query.pelanggan.findFirst({ where: eq(pelanggan.userId, u.id) });
    if (!pel) return ctx.reply("Belum ada profil pelanggan.");

    const aktif = await db
      .select()
      .from(orderHeader)
      .where(and(eq(orderHeader.pelangganId, pel.id), ne(orderHeader.status, "selesai")))
      .orderBy(desc(orderHeader.createdAt))
      .limit(5);

    if (aktif.length === 0) return ctx.reply("Tidak ada order aktif.");

    const lines = aktif.map(
      (o) =>
        `• *${o.nomorOrder}* — _${o.status}_\n  ${o.totalEstimasi.toLocaleString("id-ID")} · ${o.createdAt.toLocaleString("id-ID")}`,
    );
    return ctx.reply(`*Order Aktif Anda*\n\n${lines.join("\n")}`, { parse_mode: "Markdown" });
  });

  bot.on("message", (ctx: Context) => {
    // Hanya reply di DM (private chat). Skip di group/supergroup biar tidak spam.
    if (ctx.chat?.type !== "private") return;
    return ctx.reply("Ketik /help untuk daftar perintah.");
  });

  // Catch-all error handler supaya error API Telegram (mis. group migrated, chat not found)
  // tidak crash service, hanya log warning.
  bot.catch((err) => {
    console.warn("[telegram] bot error:", err.error instanceof Error ? err.error.message : err.error);
  });
}

export async function renderTemplate(
  key: string,
  vars: Record<string, string>,
): Promise<string> {
  const row = await db.query.pengaturan.findFirst({ where: eq(pengaturan.key, key) });
  let text = row?.value ?? "";
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, v);
  }
  return text;
}
