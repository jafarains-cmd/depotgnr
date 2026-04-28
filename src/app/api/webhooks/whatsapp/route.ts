import { NextResponse } from "next/server";
import { parseIncomingPayload } from "@/lib/whatsapp";
import { handleIncomingWA } from "@/lib/waBot";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      body = await req.json();
    } else {
      // Fonnte default: form-urlencoded
      const form = await req.formData();
      const obj: Record<string, string> = {};
      for (const [k, v] of form.entries()) obj[k] = String(v);
      body = obj;
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }

  const incoming = parseIncomingPayload(body);
  if (!incoming) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Async handle (jangan block respons webhook lama-lama)
  handleIncomingWA(incoming).catch((e) => console.error("[wa-bot] error:", e));

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return new Response("WhatsApp webhook OK. Use POST.", { status: 200 });
}
