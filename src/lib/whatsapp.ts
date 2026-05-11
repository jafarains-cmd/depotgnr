// WhatsApp adapter — pilih provider via env WHATSAPP_PROVIDER (fonnte | wablas | wweb).
// Default "fonnte" (REST API berbayar, paling stabil untuk produksi UMKM Indonesia).

type Provider = "fonnte" | "wablas" | "wweb";

function getProvider(): Provider {
  return (process.env.WHATSAPP_PROVIDER as Provider) ?? "fonnte";
}

export async function sendWhatsApp(toNumber: string, message: string): Promise<void> {
  const provider = getProvider();
  const phone = normalizePhone(toNumber);

  if (provider === "fonnte") {
    const url = process.env.WHATSAPP_API_URL ?? "https://api.fonnte.com/send";
    const token = process.env.WHATSAPP_API_KEY;
    if (!token) {
      console.warn("[whatsapp] WHATSAPP_API_KEY belum diset — pesan tidak terkirim");
      console.log(`[whatsapp:dev] -> ${phone}: ${message}`);
      return;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ target: phone, message }),
    });
    if (!res.ok) {
      throw new Error(`Fonnte error ${res.status}: ${await res.text()}`);
    }
    return;
  }

  if (provider === "wablas") {
    const url = process.env.WHATSAPP_API_URL ?? "https://console.wablas.com/api/send-message";
    const token = process.env.WHATSAPP_API_KEY;
    if (!token) {
      console.log(`[whatsapp:dev] -> ${phone}: ${message}`);
      return;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
    });
    if (!res.ok) throw new Error(`Wablas error ${res.status}`);
    return;
  }

  // "wweb" tidak cocok di edge/serverless — perlu worker terpisah.
  console.log(`[whatsapp:dev] -> ${phone}: ${message}`);
}

export function normalizePhone(input: string): string {
  let p = input.replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0")) p = `62${p.slice(1)}`;
  return p;
}

/**
 * Kirim pesan ke WhatsApp Group. Target adalah Group ID dari Fonnte:
 *   - Bisa berupa angka dengan dash (mis: '1234567890-12345')
 *   - Atau format hash unique
 * Tidak di-normalize karena bukan nomor telpon.
 *
 * Cara dapat Group ID:
 *   1. Tambahkan nomor bot Fonnte ke grup WhatsApp Anda
 *   2. Buka dashboard Fonnte → Device → Sync Group → list semua grup
 *   3. Salin Group ID
 */
export async function sendWhatsAppGroup(
  groupId: string,
  message: string,
): Promise<void> {
  const provider = getProvider();
  const target = groupId.trim();
  if (!target) {
    console.warn("[whatsapp:group] target kosong");
    return;
  }

  if (provider === "fonnte") {
    const url = process.env.WHATSAPP_API_URL ?? "https://api.fonnte.com/send";
    const token = process.env.WHATSAPP_API_KEY;
    if (!token) {
      console.log(`[whatsapp:dev:group] -> ${target}: ${message}`);
      return;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ target, message }),
    });
    if (!res.ok) {
      throw new Error(`Fonnte group error ${res.status}: ${await res.text()}`);
    }
    return;
  }

  if (provider === "wablas") {
    const url = process.env.WHATSAPP_API_URL ?? "https://console.wablas.com/api/send-message";
    const token = process.env.WHATSAPP_API_KEY;
    if (!token) {
      console.log(`[whatsapp:dev:group] -> ${target}: ${message}`);
      return;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: target, message, isGroup: true }),
    });
    if (!res.ok) throw new Error(`Wablas group error ${res.status}`);
    return;
  }

  console.log(`[whatsapp:dev:group] -> ${target}: ${message}`);
}

/**
 * Parse incoming webhook payload — provider berbeda format-nya.
 * Mengembalikan { sender, message } yang seragam.
 */
export type IncomingMessage = { sender: string; message: string };

export function parseIncomingPayload(body: unknown): IncomingMessage | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  // Fonnte: { device, sender, message, ... }
  if (typeof b.sender === "string" && typeof b.message === "string") {
    return { sender: normalizePhone(b.sender), message: b.message };
  }
  // Wablas: { phone, message, ... } atau { messages: [{ phone, message }] }
  if (typeof b.phone === "string" && typeof b.message === "string") {
    return { sender: normalizePhone(b.phone), message: b.message };
  }
  if (Array.isArray(b.messages) && b.messages.length > 0) {
    const m = b.messages[0] as Record<string, unknown>;
    if (typeof m.phone === "string" && typeof m.message === "string") {
      return { sender: normalizePhone(m.phone), message: m.message };
    }
  }
  return null;
}
