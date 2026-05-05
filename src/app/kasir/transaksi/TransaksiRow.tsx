"use client";

import { useState } from "react";
import { DetailModal } from "@/components/DetailModal";

export function TransaksiRow({
  trxId,
  children,
}: {
  trxId: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        onClick={() => setOpen(true)}
        className="hover:bg-[color:var(--surface2)] cursor-pointer"
      >
        {children}
      </tr>
      {open && <DetailModal kind="transaksi" id={trxId} onClose={() => setOpen(false)} />}
    </>
  );
}
