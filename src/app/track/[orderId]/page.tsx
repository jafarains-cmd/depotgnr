import { notFound } from "next/navigation";
import { Truck } from "lucide-react";
import { TrackMapLoader } from "./TrackMapLoader";
import { DropFill } from "@/components/GallonArt";

export const dynamic = "force-dynamic";

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { orderId: idStr } = await params;
  const { token } = await searchParams;
  const orderId = Number(idStr);
  if (!Number.isFinite(orderId) || !token) notFound();

  return (
    <div className="min-h-screen bg-[color:var(--surface2)]">
      <header className="bg-surface border-b border-line">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-brand text-white grid place-items-center">
            <DropFill size={18} color="white" />
          </span>
          <div>
            <div className="font-extrabold leading-tight">DEPOT GNR</div>
            <div className="text-[10px] text-[color:var(--muted)] leading-tight inline-flex items-center gap-1">
              <Truck size={10} /> Tracking Pengiriman
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto p-4">
        <TrackMapLoader orderId={orderId} token={token} />
      </main>
    </div>
  );
}
