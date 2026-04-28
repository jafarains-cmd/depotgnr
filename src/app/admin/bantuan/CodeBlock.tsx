"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        {language && (
          <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-800/40 rounded">
            {language}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs inline-flex items-center gap-1"
        >
          {copied ? (
            <>
              <Check size={12} /> Tersalin
            </>
          ) : (
            <>
              <Copy size={12} /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="bg-slate-900 text-slate-100 p-4 pr-24 rounded-lg overflow-auto max-h-96 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
