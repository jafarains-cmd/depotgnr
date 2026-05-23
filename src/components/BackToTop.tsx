"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Tombol melayang "kembali ke atas" yang muncul saat scroll > 600px.
 * Hanya tampil di mobile (<sm) supaya tidak ganggu layout desktop yang
 * sudah punya nav samping.
 */
export function BackToTop({ threshold = 600 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > threshold);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Kembali ke atas"
      className="fixed bottom-20 right-4 z-40 w-11 h-11 rounded-full bg-brand text-white shadow-lg grid place-items-center sm:hidden active:scale-95 transition"
    >
      <ArrowUp size={18} />
    </button>
  );
}
