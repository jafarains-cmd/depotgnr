import { webhookCallback } from "grammy";
import { getBot } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const bot = getBot();
  if (!bot) {
    return new Response("TELEGRAM_BOT_TOKEN belum diset", { status: 503 });
  }
  // grammy webhookCallback untuk Next.js (standard Web Request/Response)
  const handle = webhookCallback(bot, "std/http");
  return handle(req);
}

export async function GET() {
  return new Response("Telegram webhook OK. Use POST.", { status: 200 });
}
