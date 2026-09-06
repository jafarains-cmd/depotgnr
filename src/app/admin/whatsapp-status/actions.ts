"use server";

import { requireRole } from "@/lib/permissions";
import { sendWhatsApp, sendWhatsAppGroup } from "@/lib/whatsapp";

export type DeviceStatus = {
  ok: boolean;
  provider: string;
  connected?: boolean;
  device?: string;
  quota?: string | number | null;
  expired?: string | null;
  raw?: unknown;
  error?: string;
};

/**
 * Cek status device WA provider. Fonnte punya endpoint /device yg return
 * info connection + quota. Wablas punya /device juga. Return raw response
 * untuk debug + parsed shortcut fields.
 */
export async function checkWhatsAppStatus(): Promise<DeviceStatus> {
  await requireRole(["admin"]);

  const provider = (process.env.WHATSAPP_PROVIDER ?? "fonnte") as "fonnte" | "wablas" | "wweb";
  const token = process.env.WHATSAPP_API_KEY;

  if (!token) {
    return {
      ok: false,
      provider,
      error: "WHATSAPP_API_KEY belum di-set di env server.",
    };
  }

  if (provider === "fonnte") {
    try {
      const res = await fetch("https://api.fonnte.com/device", {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      if (!res.ok) {
        return {
          ok: false,
          provider,
          error: `HTTP ${res.status}: ${await res.text().catch(() => "")}`,
        };
      }
      const json = (await res.json()) as {
        status?: boolean;
        device?: string;
        device_status?: string;
        name?: string;
        quota?: string | number;
        expired?: string;
        messages?: string;
      };
      return {
        ok: !!json.status,
        provider,
        connected: json.device_status === "connect",
        device: json.device ?? json.name,
        quota: json.quota ?? null,
        expired: json.expired ?? null,
        raw: json,
      };
    } catch (e) {
      return {
        ok: false,
        provider,
        error: e instanceof Error ? e.message : "Network error",
      };
    }
  }

  if (provider === "wablas") {
    try {
      const res = await fetch("https://console.wablas.com/api/device/status", {
        method: "GET",
        headers: { Authorization: token },
      });
      if (!res.ok) {
        return {
          ok: false,
          provider,
          error: `HTTP ${res.status}: ${await res.text().catch(() => "")}`,
        };
      }
      const json = (await res.json()) as {
        status?: boolean;
        data?: { status?: string; device?: string; expired?: string };
      };
      return {
        ok: !!json.status,
        provider,
        connected: json.data?.status === "connected",
        device: json.data?.device,
        expired: json.data?.expired ?? null,
        raw: json,
      };
    } catch (e) {
      return {
        ok: false,
        provider,
        error: e instanceof Error ? e.message : "Network error",
      };
    }
  }

  return {
    ok: false,
    provider,
    error: `Provider "${provider}" tidak support status check (baru fonnte + wablas).`,
  };
}

/**
 * Kirim test message ke nomor tertentu. Tidak simpan log — cuma untuk verify
 * end-to-end delivery.
 */
export async function testSendWhatsApp(args: {
  target: string;
  message: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["admin"]);

  const target = args.target.trim();
  const message = args.message.trim();
  if (!target || !message) {
    return { ok: false, error: "Nomor + pesan harus diisi" };
  }
  if (message.length > 500) {
    return { ok: false, error: "Pesan test maksimal 500 karakter" };
  }

  // Detect group ID (Fonnte format: "1234567890-12345") vs nomor telp.
  // Group ID punya dash, nomor telp tidak.
  const isGroup = target.includes("-");

  try {
    if (isGroup) {
      await sendWhatsAppGroup(target, message);
    } else {
      await sendWhatsApp(target, message);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal kirim" };
  }
}
