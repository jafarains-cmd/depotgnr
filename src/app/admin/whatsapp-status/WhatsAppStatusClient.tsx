"use client";

import { useState, useTransition } from "react";
import { MessageCircle, CheckCircle2, XCircle, RefreshCw, Send, Users, AlertCircle } from "lucide-react";
import { checkWhatsAppStatus, testSendWhatsApp, type DeviceStatus } from "./actions";
import { useToast } from "@/components/Toast";

type Props = {
  env: {
    provider: string;
    apiUrl: string;
    hasKey: boolean;
    keyPreview: string | null;
  };
  groups: {
    orderMasuk: string | null;
    langganan: string | null;
  };
};

export function WhatsAppStatusClient({ env, groups }: Props) {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [checking, startCheck] = useTransition();
  const [testTarget, setTestTarget] = useState("");
  const [testMsg, setTestMsg] = useState("Test WhatsApp dari Depot Air Minum GNR.");
  const [sending, startSend] = useTransition();
  const toast = useToast();

  function check() {
    startCheck(async () => {
      const s = await checkWhatsAppStatus();
      setStatus(s);
      if (s.ok && s.connected) toast.success("Device connect + OK");
      else if (s.error) toast.error(s.error);
      else if (!s.connected) toast.error("Device tidak connect (scan ulang di dashboard provider)");
    });
  }

  function doSend() {
    startSend(async () => {
      const res = await testSendWhatsApp({ target: testTarget, message: testMsg });
      if (res.ok) toast.success(`Test terkirim ke ${testTarget}. Cek WA-nya.`);
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {/* Env config */}
      <div className="bg-surface border border-line rounded-2xl p-4">
        <div className="font-bold text-sm mb-3 inline-flex items-center gap-2">
          <MessageCircle size={16} className="text-emerald-600" /> Konfigurasi Server
        </div>
        <div className="grid grid-cols-2 gap-y-2 text-xs">
          <div className="text-[color:var(--muted)]">Provider</div>
          <div className="font-bold">{env.provider}</div>
          <div className="text-[color:var(--muted)]">API URL</div>
          <div className="font-mono text-[11px] break-all">{env.apiUrl || "(default)"}</div>
          <div className="text-[color:var(--muted)]">API Key</div>
          <div>
            {env.hasKey ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span className="font-mono">{env.keyPreview}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-rose-600">
                <XCircle size={12} /> Tidak di-set
              </span>
            )}
          </div>
        </div>
        {!env.hasKey && (
          <div className="mt-3 bg-rose-50 border border-rose-200 rounded-lg p-2 text-xs text-rose-800">
            Set env <code className="font-mono">WHATSAPP_API_KEY</code> di server (mis. via
            systemd override), restart depot-air, refresh page.
          </div>
        )}
      </div>

      {/* Live status check */}
      <div className="bg-surface border border-line rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-sm inline-flex items-center gap-2">
            <RefreshCw size={16} className="text-brand" /> Status Koneksi Device
          </div>
          <button
            onClick={check}
            disabled={checking || !env.hasKey}
            className="px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg disabled:opacity-50"
          >
            {checking ? "Cek..." : "Cek Sekarang"}
          </button>
        </div>

        {!status && (
          <div className="text-xs text-[color:var(--muted)]">
            Tap tombol untuk cek koneksi live ke {env.provider}.
          </div>
        )}

        {status && (
          <div className="space-y-2">
            {status.error ? (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-800 inline-flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold">Gagal cek status</div>
                  <div className="text-xs mt-0.5 font-mono break-all">{status.error}</div>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold ${
                    status.connected
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {status.connected ? (
                    <>
                      <CheckCircle2 size={16} /> CONNECT
                    </>
                  ) : (
                    <>
                      <XCircle size={16} /> DISCONNECT (scan ulang di dashboard)
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-xs mt-2">
                  {status.device && (
                    <>
                      <div className="text-[color:var(--muted)]">Device</div>
                      <div className="font-bold">{status.device}</div>
                    </>
                  )}
                  {status.quota !== null && status.quota !== undefined && (
                    <>
                      <div className="text-[color:var(--muted)]">Quota</div>
                      <div className="font-bold">{String(status.quota)}</div>
                    </>
                  )}
                  {status.expired && (
                    <>
                      <div className="text-[color:var(--muted)]">Aktif sampai</div>
                      <div className="font-bold">{status.expired}</div>
                    </>
                  )}
                </div>
                {status.raw && (
                  <details className="mt-2">
                    <summary className="text-[11px] text-[color:var(--muted)] cursor-pointer">
                      Raw response (debug)
                    </summary>
                    <pre className="mt-1 bg-slate-50 rounded p-2 text-[10px] overflow-auto max-h-40">
                      {JSON.stringify(status.raw, null, 2)}
                    </pre>
                  </details>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Grup WA config */}
      <div className="bg-surface border border-line rounded-2xl p-4">
        <div className="font-bold text-sm mb-3 inline-flex items-center gap-2">
          <Users size={16} className="text-blue-600" /> Grup WA untuk Notifikasi
        </div>
        <div className="grid grid-cols-1 gap-2 text-xs">
          <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
            <span className="text-[color:var(--muted)]">Order Masuk</span>
            <span className="font-mono text-[11px]">
              {groups.orderMasuk ?? <span className="text-rose-600">— belum di-set</span>}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
            <span className="text-[color:var(--muted)]">Langganan (fallback → Order)</span>
            <span className="font-mono text-[11px]">
              {groups.langganan ?? <span className="text-[color:var(--muted)]">— fallback</span>}
            </span>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-[color:var(--muted)]">
          Set di <a href="/admin/pengaturan?tab=notifikasi" className="text-brand underline">Pengaturan → Notifikasi</a>.
          Cara dapat Group ID: di dashboard Fonnte → Device → Sync Group → copy ID.
        </div>
      </div>

      {/* Test send */}
      <div className="bg-surface border border-line rounded-2xl p-4">
        <div className="font-bold text-sm mb-3 inline-flex items-center gap-2">
          <Send size={16} className="text-brand" /> Test Kirim
        </div>
        <div className="space-y-2">
          <input
            type="text"
            value={testTarget}
            onChange={(e) => setTestTarget(e.target.value)}
            placeholder="Nomor tujuan (08xxx / 62xxx) atau Group ID"
            className="w-full px-3 py-2 border border-line rounded-lg text-sm"
          />
          <textarea
            value={testMsg}
            onChange={(e) => setTestMsg(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-line rounded-lg text-sm resize-none"
          />
          <button
            onClick={doSend}
            disabled={sending || !env.hasKey || !testTarget || !testMsg}
            className="w-full py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg disabled:opacity-50"
          >
            {sending ? "Kirim..." : "Kirim Test"}
          </button>
        </div>
        <div className="mt-2 text-[11px] text-[color:var(--muted)]">
          Untuk test grup: paste Group ID (mis. <code>1234567890-12345</code>) di field nomor.
        </div>
      </div>
    </div>
  );
}
