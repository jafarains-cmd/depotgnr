import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type Session } from "./auth";

export type Role = "admin" | "kasir" | "kurir" | "pelanggan";

export async function getSession(): Promise<Session | null> {
  return await auth.api.getSession({ headers: await headers() });
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireRole(roles: Role[]): Promise<Session> {
  const s = await requireSession();
  const role = (s.user as { role?: Role }).role ?? "pelanggan";
  if (!roles.includes(role)) redirect("/forbidden");
  return s;
}
