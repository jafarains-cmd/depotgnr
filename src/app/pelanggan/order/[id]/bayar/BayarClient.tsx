"use client";

import { useState, useTransition, useTransition as useT2 } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Copy, Loader2, QrCode, Wallet, Building2, HandCoins, Gift } from "lucide-react";
import { pilihMetodeBayar, submitBuktiBayar, pakaiLoyalty } from "./actions";
import { formatRupiah } from "@/lib/utils";
import { normalizeDriveUrl } from "@/lib/drive-url";

type Metode = "cash" | "transfer" | "qris" | "dana" | "cod";

export function BayarClient({
  orderId,
  nomorOrder,
  total,
  totalAsli,
  loyaltiDipakai,
  saldoLoyalti,
  metodeBayar,
  buktiUrl,
  qrisFotoUrl,
  nomorDana,
  atasNamaDana,
  rekeningList,
}: {
  orderId: number;
  nomorOrder: string;
  total: number;
  totalAsli: number;
  loyaltiDipakai: number;
  saldoLoyalti: number;
  metodeBayar: Metode | null;
  buktiUrl: string | null;
  qrisFotoUrl: string | null;
  nomorDana: string | null;
  atasNamaDana: string | null;
  rekeningList: { bank: string; nomor: string; atasNama: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const selected = metodeBayar;

  function handlePilih(m: Metode) {
    setMsg(null);
    startTransition(async () => {
      const res = await pilihMetodeBayar(orderId, m);
      if ("error" in res) setMsg({ ok: false, text: res.error });
      else router.refresh();
    });
  }

  function handleFile(f: File) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMsg(null);
  }

  function handleSubmit() {
    if (!file) {
      setMsg({ ok: false, text: "Pilih foto bukti dulu" });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const buf = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);
      const res = await submitBuktiBayar({
        orderId,
        base64,
        mimeType: file.type || "image/jpeg",
      });
      if ("error" in res) {
        setMsg({ ok: false, text: res.error });
      } else {
        setMsg({ ok: true, text: "Bukti terkirim. Menunggu verifikasi." });
        setTimeout(() => router.refresh(), 800);
      }
    });
  }

  return (
    <div className="space-y-4">
      <LoyaltyBlock
        orderId={orderId}
        saldo={saldoLoyalti}
        dipakai={loyaltiDipakai}
        totalAsli={totalAsli}
      />

      <div className="bg-surface border border-line rounded-2xl p-4">
        <div className="text-sm font-semibold mb-2">Pilih metode pembayaran</div>
        <div className="grid grid-cols-2 gap-2">
          <MetodeButton
            active={selected === "qris"}
            icon={<QrCode size={20} />}
            label="QRIS"
            onClick={() => handlePilih("qris")}
            disabled={pending}
          />
          <MetodeButton
            active={selected === "dana"}
            icon={<Wallet size={20} />}
            label="DANA"
            onClick={() => handlePilih("dana")}
            disabled={pending}
          />
          <MetodeButton
            active={selected === "transfer"}
            icon={<Building2 size={20} />}
            label="Transfer Bank"
            onClick={() => handlePilih("transfer")}
            disabled={pending}
          />
          <MetodeButton
            active={selected === "cod"}
            icon={<HandCoins size={20} />}
            label="Bayar saat antar"
            onClick={() => handlePilih("cod")}
            disabled={pending}
          />
        </div>
      </div>

      {selected === "qris" && (
        <PaymentInfo title="Bayar via QRIS" total={total} ref={nomorOrder}>
          {qrisFotoUrl ? (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={normalizeDriveUrl(qrisFotoUrl)}
                alt="QRIS"
                className="w-64 h-64 object-contain rounded-lg border border-line"
              />
              <p className="text-xs text-[color:var(--muted)]">
                Scan QR ini di aplikasi e-wallet/m-banking apa saja.
              </p>
            </div>
          ) : (
            <p className="text-sm text-amber-700">Admin belum upload gambar QRIS. Hubungi depot.</p>
          )}
        </PaymentInfo>
      )}

      {selected === "dana" && (
        <PaymentInfo title="Bayar via DANA" total={total} ref={nomorOrder}>
          {nomorDana ? (
            <div className="space-y-2">
              <CopyRow label="Nomor DANA" value={nomorDana} />
              {atasNamaDana && <CopyRow label="Atas Nama" value={atasNamaDana} />}
              <p className="text-xs text-[color:var(--muted)] mt-2">
                Buka aplikasi DANA → Kirim → masukkan nomor di atas → bayar tepat sesuai nominal.
              </p>
            </div>
          ) : (
            <p className="text-sm text-amber-700">Admin belum set nomor DANA. Hubungi depot.</p>
          )}
        </PaymentInfo>
      )}

      {selected === "transfer" && (
        <PaymentInfo title="Bayar via Transfer Bank" total={total} ref={nomorOrder}>
          {rekeningList.length > 0 ? (
            <div className="space-y-3">
              {rekeningList.map((r, i) => (
                <div key={i} className="border border-line rounded-lg p-3 space-y-1">
                  <div className="font-semibold text-sm">{r.bank}</div>
                  <CopyRow label="Nomor Rekening" value={r.nomor} />
                  <div className="text-xs text-[color:var(--muted)]">a.n. {r.atasNama}</div>
                </div>
              ))}
              <p className="text-xs text-[color:var(--muted)]">
                Transfer tepat sesuai nominal di atas. Lebih disarankan transfer sesama bank biar
                cepat verifikasi.
              </p>
            </div>
          ) : (
            <p className="text-sm text-amber-700">Admin belum set rekening. Hubungi depot.</p>
          )}
        </PaymentInfo>
      )}

      {selected === "cod" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 text-sm">
          <div className="font-semibold mb-1">Bayar saat barang diantar</div>
          <p className="text-xs">
            Siapkan uang tunai sebesar {formatRupiah(total)}. Tidak perlu upload bukti.
          </p>
        </div>
      )}

      {(selected === "qris" || selected === "dana" || selected === "transfer") && (
        <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          <div className="text-sm font-semibold inline-flex items-center gap-1.5">
            <Camera size={16} /> Upload Bukti Pembayaran
          </div>
          <p className="text-xs text-[color:var(--muted)]">
            Screenshot bukti transfer / pembayaran dari aplikasi Anda.
          </p>

          <label className="block">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="hidden"
            />
            <div className="cursor-pointer aspect-video bg-[color:var(--surface2)] border-2 border-dashed border-line rounded-lg flex items-center justify-center overflow-hidden hover:border-brand-400">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Bukti" className="w-full h-full object-cover" />
              ) : buktiUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={buktiUrl} alt="Bukti" className="w-full h-full object-cover opacity-60" />
              ) : (
                <div className="text-center text-[color:var(--muted)] text-sm py-6">
                  <Camera size={28} className="mx-auto mb-1" />
                  Tap untuk upload bukti
                </div>
              )}
            </div>
          </label>

          {msg && (
            <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
              {msg.text}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={pending || !file}
            className="w-full py-3 bg-brand-600 text-white rounded-lg font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {pending ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
            {pending ? "Mengirim..." : "Kirim Bukti Pembayaran"}
          </button>
        </div>
      )}
    </div>
  );
}

function LoyaltyBlock({
  orderId,
  saldo,
  dipakai,
  totalAsli,
}: {
  orderId: number;
  saldo: number;
  dipakai: number;
  totalAsli: number;
}) {
  const [pending, startTransition] = useT2();
  const [pakai, setPakai] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  if (dipakai > 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm inline-flex items-center gap-2">
        <Gift size={16} className="text-emerald-600" />
        <span>
          Saldo loyalty dipakai: <b>{formatRupiah(dipakai)}</b>
        </span>
      </div>
    );
  }
  if (saldo <= 0) return null;

  const max = Math.max(0, totalAsli - 1);
  const useAble = Math.min(saldo, max);

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
      <div className="text-sm font-semibold inline-flex items-center gap-1.5">
        <Gift size={16} /> Saldo Loyalty
      </div>
      <div className="text-xs text-[color:var(--muted)]">
        Saldo Anda: <b>{formatRupiah(saldo)}</b>. Maksimal pakai{" "}
        <b>{formatRupiah(useAble)}</b> di order ini.
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          max={useAble}
          placeholder="Jumlah saldo dipakai"
          value={pakai}
          onChange={(e) => setPakai(e.target.value)}
          className="flex-1 px-3 py-2 border border-line rounded-md text-sm"
        />
        <button
          onClick={() => setPakai(String(useAble))}
          className="px-3 bg-[color:var(--surface2)] rounded-md text-xs"
        >
          Pakai semua
        </button>
      </div>
      {msg && <p className="text-xs text-red-600">{msg}</p>}
      <button
        onClick={() => {
          const n = Number(pakai);
          if (!Number.isFinite(n) || n <= 0) {
            setMsg("Masukkan angka > 0");
            return;
          }
          setMsg(null);
          startTransition(async () => {
            const res = await pakaiLoyalty(orderId, n);
            if ("error" in res) setMsg(res.error);
            else window.location.reload();
          });
        }}
        disabled={pending}
        className="w-full py-2 bg-emerald-600 text-white rounded-md text-sm disabled:opacity-50"
      >
        {pending ? "Memproses..." : "Pakai Saldo"}
      </button>
    </div>
  );
}

function MetodeButton({
  active,
  icon,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 text-sm transition disabled:opacity-50 ${
        active
          ? "border-brand-600 bg-brand-50 text-brand-700"
          : "border-line bg-surface hover:border-line"
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function PaymentInfo({
  title,
  total,
  ref,
  children,
}: {
  title: string;
  total: number;
  ref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <div className="text-sm font-semibold">{title}</div>
      <div className="bg-amber-50 border border-amber-200 rounded p-2 text-sm">
        <div className="text-xs text-[color:var(--muted)]">Bayar tepat:</div>
        <div className="text-lg font-bold text-amber-900">{formatRupiah(total)}</div>
        <div className="text-xs text-[color:var(--muted)]">Ref: {ref}</div>
      </div>
      {children}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-xs text-[color:var(--muted)]">{label}</div>
        <div className="font-mono text-sm font-semibold truncate">{value}</div>
      </div>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="px-2 py-1 text-xs bg-[color:var(--surface2)] hover:bg-[color:var(--surface2)] rounded inline-flex items-center gap-1"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "Tersalin" : "Salin"}
      </button>
    </div>
  );
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
