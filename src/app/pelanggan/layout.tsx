import { PelangganShell } from "@/components/PelangganShell";
import { requireSession } from "@/lib/permissions";

export default async function PelangganLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <PelangganShell userName={session.user.name}>{children}</PelangganShell>;
}
