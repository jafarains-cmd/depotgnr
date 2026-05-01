import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type Session } from "./auth";

export type Role = "admin" | "kasir" | "kurir" | "pelanggan";

export async function getSession(): Promise<Session | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  return s;
}

/**
 * Require an active session.
 * Banned users are auto-logged-out (or blocked from accessing the page) — schema has
 * `banned`, `banReason`, `banExpires`. If banExpires is past, treat as unbanned.
 */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  const u = s.user as Session["user"] & { banned?: boolean; banExpires?: Date | string | null };
  if (u.banned) {
    const expires = u.banExpires ? new Date(u.banExpires) : null;
    if (!expires || expires.getTime() > Date.now()) {
      redirect("/forbidden?reason=banned");
    }
  }
  return s;
}

export async function requireRole(roles: Role[]): Promise<Session> {
  const s = await requireSession();
  const role = (s.user.role ?? "pelanggan") as Role;
  if (!roles.includes(role)) redirect("/forbidden");
  return s;
}
