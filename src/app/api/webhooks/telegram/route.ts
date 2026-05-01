import { webhookCallback } from "grammy";
import { getBot } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Telegram webhook. Verifikasi via X-Telegram-Bot-Api-Secret-Token header
 * yang di-set saat panggil setWebhook(secret_token=...). Mencegah spoof endpoint public.
 *
 * ENV: TELEGRAM_WEBHOOK_SECRET (optional). Kalau diset, request tanpa header valid akan ditolak.
 */
export async function POST(req: Request) {
  const bot = getBot();
  if (!bot) {
    return new Response("TELEGRAM_BOT_TOKEN belum diset", { status: 503 });
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== secret) {
      return new Response("invalid secret", { status: 401 });
    }
  }

  const handle = webhookCallback(bot, "std/http");
  return handle(req);
}

export async function GET() {
  return new Response("Telegram webhook OK. Use POST.", { status: 200 });
}
