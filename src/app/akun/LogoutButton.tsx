"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="text-sm text-slate-600 hover:text-red-600 inline-flex items-center gap-1"
    >
      <LogOut size={14} /> Keluar
    </button>
  );
}
