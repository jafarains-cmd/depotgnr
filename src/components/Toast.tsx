"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, X, Info, AlertTriangle } from "lucide-react";

type ToastKind = "success" | "error" | "info" | "warn";
type ToastItem = { id: string; kind: ToastKind; message: string; ttl: number };

type ToastCtx = {
  show: (msg: string, kind?: ToastKind, ttl?: number) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  warn: (msg: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

const DEFAULT_TTL = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const show = useCallback(
    (message: string, kind: ToastKind = "info", ttl: number = DEFAULT_TTL) => {
      const id = `t-${Date.now()}-${counterRef.current++}`;
      setItems((cur) => [...cur, { id, kind, message, ttl }]);
      window.setTimeout(() => {
        setItems((cur) => cur.filter((t) => t.id !== id));
      }, ttl);
    },
    [],
  );

  const ctx: ToastCtx = {
    show,
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error", 5000),
    info: (m) => show(m, "info"),
    warn: (m) => show(m, "warn", 4500),
  };

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <div
        aria-live="polite"
        className="fixed z-[100] bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm flex flex-col gap-2 pointer-events-none"
      >
        {items.map((t) => (
          <ToastView
            key={t.id}
            item={t}
            onClose={() => setItems((cur) => cur.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const id = useId();
  useEffect(() => {
    setMounted(true);
  }, []);

  const cfg = {
    success: { bg: "bg-emerald-600", icon: <Check size={16} /> },
    error: { bg: "bg-rose-600", icon: <X size={16} /> },
    info: { bg: "bg-slate-800", icon: <Info size={16} /> },
    warn: { bg: "bg-amber-600", icon: <AlertTriangle size={16} /> },
  }[item.kind];

  return (
    <div
      id={id}
      onClick={onClose}
      className={`${cfg.bg} text-white rounded-xl shadow-lg px-3 py-2.5 flex items-start gap-2 pointer-events-auto cursor-pointer text-sm transition-all ${
        mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
      role="status"
    >
      <span className="mt-0.5 flex-shrink-0">{cfg.icon}</span>
      <div className="flex-1 min-w-0 font-medium whitespace-pre-wrap break-words">
        {item.message}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="opacity-70 hover:opacity-100 flex-shrink-0"
        aria-label="Tutup"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast(): ToastCtx {
  const c = useContext(Ctx);
  if (!c) {
    // Fallback ke alert kalau ToastProvider belum ada (saat dev)
    return {
      show: (m) => window.alert(m),
      success: (m) => window.alert(`✓ ${m}`),
      error: (m) => window.alert(`✗ ${m}`),
      info: (m) => window.alert(m),
      warn: (m) => window.alert(`⚠ ${m}`),
    };
  }
  return c;
}
