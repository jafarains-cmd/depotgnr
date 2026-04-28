import { eq, and, ne, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan } from "@/db/schema/pelanggan";
import { produk } from "@/db/schema/produk";
import { orderHeader, orderItem } from "@/db/schema/order";
import { chatSession, pengaturan } from "@/db/schema/pengaturan";
import { sendWhatsApp, normalizePhone, type IncomingMessage } from "@/lib/whatsapp";
import { notifGrupOrder, renderTemplate } from "@/lib/telegram";
import { pushOrder } from "@/lib/sheets";
import { generateNomorNota, formatRupiah } from "@/lib/utils";

type State = "idle" | "order_items" | "order_alamat";

type SessionData = {
  items?: { produkId: number; qty: number; jenis: "isi_ulang" | "tukar" | "beli_baru" }[];
};

export async function handleIncomingWA(msg: IncomingMessage): Promise<void> {
  const sender = normalizePhone(msg.sender);
  const text = msg.message.trim();
  const upper = text.toUpperCase();

  const sess = await getOrCreateSession(sender);
  const state = sess.state as State;
  const data: SessionData = parseData(sess.data);

  // Global commands
  if (["BANTUAN", "HELP", "MENU"].includes(upper)) {
    await sendWhatsApp(sender, helpMessage());
    return resetSession(sender);
  }
  if (upper === "PRODUK" || upper === "HARGA") {
    await sendWhatsApp(sender, await katalogMessage());
    return;
  }
  if (upper === "STATUS") {
    await sendWhatsApp(sender, await statusMessage(sender));
    return;
  }
  if (upper === "BATAL" || upper === "CANCEL") {
    await resetSession(sender);
    await sendWhatsApp(sender, "❌ Dibatalkan. Ketik *MENU* untuk panduan.");
    return;
  }

  // State machine order wizard
  if (upper === "ORDER" || state === "idle") {
    if (upper === "ORDER") {
      await setSession(sender, "order_items", {});
      await sendWhatsApp(sender, await katalogMessage(true));
      return;
    }
    await sendWhatsApp(sender, helpMessage());
    return;
  }

  if (state === "order_items") {
    const items = parseItemsInput(text);
    if (items.length === 0) {
      await sendWhatsApp(
        sender,
        "Format tidak dikenali. Contoh: *P1 5 ; P2 2*\n(kode produk + qty, pisah dengan titik koma)\n\nKetik *BATAL* untuk membatalkan.",
      );
      return;
    }
    // Validasi produk ada
    const ids = [...new Set(items.map((i) => i.produkId))];
    const found = await db.query.produk.findMany({ where: inArray(produk.id, ids) });
    if (found.length !== ids.length) {
      await sendWhatsApp(sender, "Salah satu kode produk tidak valid. Cek lagi.");
      return;
    }
    await setSession(sender, "order_alamat", { items });
    await sendWhatsApp(
      sender,
      "Kirim alamat lengkap untuk pengantaran:\n(atau ketik *BATAL* untuk membatalkan)",
    );
    return;
  }

  if (state === "order_alamat") {
    if (text.length < 5) {
      await sendWhatsApp(sender, "Alamat terlalu pendek. Coba lagi.");
      return;
    }
    if (!data.items?.length) {
      await resetSession(sender);
      await sendWhatsApp(sender, "Sesi kadaluarsa, ketik *ORDER* untuk mulai ulang.");
      return;
    }
    await createOrderFromWA(sender, data.items, text);
    await resetSession(sender);
    return;
  }

  await sendWhatsApp(sender, helpMessage());
}

function helpMessage(): string {
  return [
    "*Bot Depot Air Minum*",
    "",
    "Perintah:",
    "• *ORDER* — buat order baru",
    "• *PRODUK* — daftar produk & harga",
    "• *STATUS* — cek order aktif",
    "• *BATAL* — batalkan sesi",
  ].join("\n");
}

async function katalogMessage(forOrder = false): Promise<string> {
  const list = await db.query.produk.findMany({
    where: eq(produk.aktif, true),
    orderBy: (p, { asc }) => [asc(p.id)],
  });
  const lines: string[] = [];
  list.forEach((p, i) => {
    const code = `P${i + 1}`;
    lines.push(`*${code}* — ${p.nama}`);
    if (p.hargaIsiUlang > 0) lines.push(`   IU isi ulang: ${formatRupiah(p.hargaIsiUlang)}`);
    if (p.hargaTukar > 0) lines.push(`   TK tukar galon: ${formatRupiah(p.hargaTukar)}`);
    if (p.hargaBeliBaru > 0) lines.push(`   BB beli baru: ${formatRupiah(p.hargaBeliBaru)}`);
  });
  const tip = forOrder
    ? "\n\nFormat order: *P<no> <qty> <jenis>*\nContoh:\n• `P1 5` (default isi ulang)\n• `P1 2 TK` (tukar)\n• `P2 1 BB` (beli baru)\n\nGabungkan banyak item dengan `;` :\n`P1 5 ; P2 2 TK ; P1 1 BB`"
    : "";
  return ["*Katalog Produk*", ...lines].join("\n") + tip;
}

async function statusMessage(sender: string): Promise<string> {
  const u = await db.query.user.findFirst({ where: eq(userTable.phoneNumber, sender) });
  let pelId: number | null = null;
  if (u) {
    const p = await db.query.pelanggan.findFirst({ where: eq(pelanggan.userId, u.id) });
    pelId = p?.id ?? null;
  }
  if (!pelId) {
    const p = await db.query.pelanggan.findFirst({ where: eq(pelanggan.telp, sender) });
    pelId = p?.id ?? null;
  }
  if (!pelId) return "Nomor Anda belum terdaftar di sistem. Daftar dulu via web.";

  const aktif = await db
    .select()
    .from(orderHeader)
    .where(and(eq(orderHeader.pelangganId, pelId), ne(orderHeader.status, "selesai")))
    .orderBy(desc(orderHeader.createdAt))
    .limit(5);

  if (aktif.length === 0) return "Tidak ada order aktif.";
  return (
    "*Order Aktif*\n\n" +
    aktif
      .map(
        (o) =>
          `• ${o.nomorOrder} — _${o.status}_\n  ${formatRupiah(o.totalEstimasi)}`,
      )
      .join("\n")
  );
}

type Jenis = "isi_ulang" | "tukar" | "beli_baru";

const JENIS_ALIAS: Record<string, Jenis> = {
  IU: "isi_ulang",
  ISI: "isi_ulang",
  ISIULANG: "isi_ulang",
  TK: "tukar",
  TUKAR: "tukar",
  BB: "beli_baru",
  BELI: "beli_baru",
  BELIBARU: "beli_baru",
};

/**
 * Parse input "P1 5 ; P2 2 TK ; P3 1 BB" — kode produk relatif + qty + jenis opsional.
 * Default jenis = isi_ulang. Mengembalikan list dengan produkId relatif (urutan katalog).
 */
function parseItemsInput(
  input: string,
): { produkId: number; qty: number; jenis: Jenis }[] {
  const parts = input.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  const out: { produkId: number; qty: number; jenis: Jenis }[] = [];
  for (const p of parts) {
    const m = p.match(/^P(\d+)\s+(\d+)(?:\s+([A-Za-z]+))?$/i);
    if (!m) continue;
    const jenisRaw = (m[3] ?? "IU").toUpperCase();
    const jenis = JENIS_ALIAS[jenisRaw];
    if (!jenis) continue;
    out.push({ produkId: Number(m[1]), qty: Number(m[2]), jenis });
  }
  return out;
}

async function createOrderFromWA(
  sender: string,
  itemsRaw: { produkId: number; qty: number; jenis: Jenis }[],
  alamat: string,
): Promise<void> {
  // Resolve kode P1, P2 → produkId asli (urutan katalog aktif)
  const list = await db.query.produk.findMany({
    where: eq(produk.aktif, true),
    orderBy: (p, { asc }) => [asc(p.id)],
  });
  const items = itemsRaw
    .map((it) => {
      const p = list[it.produkId - 1];
      if (!p) return null;
      const harga =
        it.jenis === "isi_ulang"
          ? p.hargaIsiUlang
          : it.jenis === "tukar"
            ? p.hargaTukar
            : p.hargaBeliBaru;
      if (harga <= 0) return null; // jenis tidak tersedia untuk produk ini
      return { produkId: p.id, qty: it.qty, jenis: it.jenis, hargaEstimasi: harga };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (items.length === 0) {
    await sendWhatsApp(sender, "Tidak ada item valid. Mulai ulang dengan *ORDER*.");
    return;
  }

  // Cari pelanggan
  let pelId: number | null = null;
  let namaPelanggan = sender;
  const u = await db.query.user.findFirst({ where: eq(userTable.phoneNumber, sender) });
  if (u) {
    const p = await db.query.pelanggan.findFirst({ where: eq(pelanggan.userId, u.id) });
    if (p) {
      pelId = p.id;
      namaPelanggan = p.nama;
    }
  }
  if (!pelId) {
    const p = await db.query.pelanggan.findFirst({ where: eq(pelanggan.telp, sender) });
    if (p) {
      pelId = p.id;
      namaPelanggan = p.nama;
    }
  }
  if (!pelId) {
    // Auto-create pelanggan
    const [created] = await db
      .insert(pelanggan)
      .values({ nama: `WA ${sender}`, telp: sender, alamat, tipe: "umum" })
      .returning();
    pelId = created.id;
    namaPelanggan = created.nama;
  }

  const totalEstimasi = items.reduce((s, it) => s + it.hargaEstimasi * it.qty, 0);
  const nomorOrder = generateNomorNota("ORD");

  const newOrderId = db.transaction((tx) => {
    const [o] = tx
      .insert(orderHeader)
      .values({
        nomorOrder,
        pelangganId: pelId,
        sumber: "whatsapp",
        alamatAntar: alamat,
        status: "pending",
        totalEstimasi,
      })
      .returning()
      .all();
    for (const it of items) {
      tx.insert(orderItem)
        .values({
          orderId: o.id,
          produkId: it.produkId,
          qty: it.qty,
          jenis: it.jenis,
          hargaEstimasi: it.hargaEstimasi,
        })
        .run();
    }
    return o.id;
  });

  pushOrder(newOrderId).catch((e) => console.warn("[sheets] pushOrder WA:", e));

  await sendWhatsApp(
    sender,
    `✅ Order *${nomorOrder}* diterima\nTotal estimasi: ${formatRupiah(totalEstimasi)}\n\nKami akan segera memproses pesanan Anda.`,
  );

  // Notif admin / grup
  notifGrupOrder(
    "pending",
    await renderTemplate("templateNotifOrderMasukAdmin", {
      nomorOrder,
      namaPelanggan,
      jumlahItem: String(items.reduce((s, i) => s + i.qty, 0)),
      totalEstimasi: totalEstimasi.toLocaleString("id-ID"),
      alamatAntar: alamat,
    }),
  ).catch(() => {});
}

// ─────────────────── Session helpers ───────────────────

async function getOrCreateSession(chatId: string) {
  const existing = await db.query.chatSession.findFirst({
    where: and(eq(chatSession.channel, "whatsapp"), eq(chatSession.chatId, chatId)),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(chatSession)
    .values({ channel: "whatsapp", chatId, state: "idle" })
    .returning();
  return created;
}

async function setSession(chatId: string, state: State, data: SessionData) {
  await db
    .update(chatSession)
    .set({ state, data: JSON.stringify(data), updatedAt: new Date() })
    .where(and(eq(chatSession.channel, "whatsapp"), eq(chatSession.chatId, chatId)));
}

async function resetSession(chatId: string) {
  await db
    .update(chatSession)
    .set({ state: "idle", data: null, updatedAt: new Date() })
    .where(and(eq(chatSession.channel, "whatsapp"), eq(chatSession.chatId, chatId)));
}

function parseData(s: string | null | undefined): SessionData {
  if (!s) return {};
  try {
    return JSON.parse(s) as SessionData;
  } catch {
    return {};
  }
}

// suppress unused warning when only used internally
void pengaturan;
