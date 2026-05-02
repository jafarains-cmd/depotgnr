import { PelangganShell } from "@/components/PelangganShell";
import { requireSession } from "@/lib/permissions";
import { getOrCreatePelanggan } from "@/lib/pelanggan";
import { countPesananBelumTuntas } from "@/lib/notifications";

export default async function PelangganLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const pel = await getOrCreatePelanggan(session.user.id, session.user.name);
  const pesananBadge = await countPesananBelumTuntas(pel.id);

  return (
    <PelangganShell
      userName={session.user.name}
      badges={{ pesanan: pesananBadge }}
    >
      {children}
    </PelangganShell>
  );
}
