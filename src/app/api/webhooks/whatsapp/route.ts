import { NextResponse } from "next/server";
import { parseIncomingPayload } from "@/lib/whatsapp";
import { handleIncomingWA } from "@/lib/waBot";

export const dynamic = "force-dynamic";

/**
 * WhatsApp incoming webhook. Verifikasi via shared secret di header atau query string.
 *
 * ENV: WHATSAPP_WEBHOOK_SECRET (optional). Kalau diset:
 *  - terima header `x-webhook-secret: <secret>` ATAU
 *  - terima query `?secret=<secret>`.
 * Set ini saat konfigurasi webhook URL di Fonnte/Wablas: `https://.../webhooks/whatsapp?secret=XXX`
 */
export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const got = req.headers.get("x-webhook-secret") ?? url.searchParams.get("secret");
    if (got !== secret) {
      return NextResponse.json({ ok: false, error: "invalid secret" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      body = await req.json();
    } else {
      const form = await req.formData();
      const obj: Record<string, string> = {};
      for (const [k, v] of form.entries()) obj[k] = String(v);
      body = obj;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }

  const incoming = parseIncomingPayload(body);
  if (!incoming) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Async handle (jangan blok respons webhook)
  handleIncomingWA(incoming).catch((e) => console.error("[wa-bot] error:", e));

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return new Response("WhatsApp webhook OK. Use POST.", { status: 200 });
}
