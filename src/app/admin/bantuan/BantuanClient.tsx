"use client";

import { useState } from "react";
import { BookOpen, User, Wrench } from "lucide-react";
import { PanduanAdminContent } from "./PanduanAdminContent";
import { PanduanKasirContent } from "./PanduanKasirContent";

type Tab = "admin" | "kasir" | "setup";

export function BantuanClient({
  setupContent,
  defaultTab = "admin",
}: {
  setupContent: React.ReactNode;
  defaultTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "admin", label: "Panduan Admin", icon: <User size={14} /> },
    { id: "kasir", label: "Panduan Kasir", icon: <BookOpen size={14} /> },
    { id: "setup", label: "Setup Teknis", icon: <Wrench size={14} /> },
  ];

  return (
    <div>
      <div className="sticky top-0 z-10 bg-[color:var(--surface2)] pb-3 -mx-4 md:mx-0 md:pt-1 px-4 md:px-0">
        <div className="flex gap-1 border-b border-line overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition whitespace-nowrap ${
                  active
                    ? "border-brand text-brand"
                    : "border-transparent text-[color:var(--muted)] hover:text-ink"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        {tab === "admin" && <PanduanAdminContent />}
        {tab === "kasir" && <PanduanKasirContent />}
        {tab === "setup" && setupContent}
      </div>
    </div>
  );
}
