import { notFound } from "next/navigation";
import { TrackMapLoader } from "./TrackMapLoader";

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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="font-bold text-brand-700">Depot Air — Tracking Pengiriman</div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto p-4">
        <TrackMapLoader orderId={orderId} token={token} />
      </main>
    </div>
  );
}
