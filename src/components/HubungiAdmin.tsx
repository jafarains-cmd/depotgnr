import Link from "next/link";
import { MessageCircle, Send } from "lucide-react";

/**
 * Normalize nomor WA: hapus selain digit, kalau awal 0 ganti 62, kalau +62 hapus +.
 * Return null kalau invalid.
 */
function normalizeWA(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  let n = digits;
  if (n.startsWith("+")) n = n.slice(1);
  if (n.startsWith("0")) n = "62" + n.slice(1);
  if (!n.startsWith("62")) n = "62" + n;
  if (n.length < 9 || n.length > 16) return null;
  return n;
}

/**
 * Normalize Telegram username: hapus @ kalau ada, terima link t.me/xxx.
 * Return null kalau kosong.
 */
function normalizeTelegram(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("http")) return t;
  if (t.startsWith("t.me/")) return `https://${t}`;
  return `https://t.me/${t.replace(/^@/, "")}`;
}

export function HubungiAdmin({
  kontakWA,
  kontakTelegram,
  pesan = "Halo admin Depot GNR, saya mau bertanya...",
}: {
  kontakWA?: string | null;
  kontakTelegram?: string | null;
  pesan?: string;
}) {
  const waNumber = kontakWA ? normalizeWA(kontakWA) : null;
  const tgUrl = kontakTelegram ? normalizeTelegram(kontakTelegram) : null;

  if (!waNumber && !tgUrl) return null;

  const waUrl = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(pesan)}`
    : null;

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <div>
        <div className="font-extrabold text-sm inline-flex items-center gap-1.5">
          🛟 Butuh Bantuan?
        </div>
        <p className="text-xs text-[color:var(--muted)] mt-0.5">
          Hubungi admin lewat WA atau Telegram untuk pertanyaan, komplain cepat,
          atau bantuan order.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {waUrl && (
          <Link
            href={waUrl}
            target="_blank"
            rel="noopener"
            className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-extrabold inline-flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
          >
            <MessageCircle size={16} /> WhatsApp
          </Link>
        )}
        {tgUrl && (
          <Link
            href={tgUrl}
            target="_blank"
            rel="noopener"
            className="py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-extrabold inline-flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
          >
            <Send size={16} /> Telegram
          </Link>
        )}
      </div>
    </div>
  );
}
