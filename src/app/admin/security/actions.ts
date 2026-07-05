"use server";

import { desc, gte } from "drizzle-orm";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { requireRole } from "@/lib/permissions";
import { db } from "@/db";
import { auditLog } from "@/db/schema/audit";
import { user as userTable } from "@/db/schema/auth";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

const execAsync = promisify(exec);

export type NpmAuditResult = {
  ok: true;
  metadata: {
    vulnerabilities: Record<string, number>;
    dependencies: {
      prod: number;
      dev: number;
      total: number;
    };
  };
  ranAt: string;
  raw?: string;
};

export type NpmAuditError = { error: string; raw?: string };

/**
 * Jalankan npm audit --json dan parse hasilnya.
 * Return summary vulnerabilities per severity.
 */
export async function runNpmAudit(): Promise<NpmAuditResult | NpmAuditError> {
  const session = await requireRole(["admin"]);
  try {
    const { stdout, stderr } = await execAsync("npm audit --json --production", {
      cwd: process.cwd(),
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const raw = stdout || stderr;
    const parsed = JSON.parse(raw);
    const vulnerabilities: Record<string, number> = parsed.metadata?.vulnerabilities ?? {};
    const dependencies = parsed.metadata?.dependencies ?? {
      prod: 0,
      dev: 0,
      total: 0,
    };

    await logAudit({
      actorUserId: session.user.id,
      action: "security.npm-audit",
      entity: "system",
      entityId: "npm-audit",
      after: { vulnerabilities, dependencies },
    });

    return {
      ok: true,
      metadata: { vulnerabilities, dependencies },
      ranAt: new Date().toISOString(),
    };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = e.stdout || e.stderr || "";
    // npm audit exit non-zero saat ada vulnerability — coba parse tetap
    try {
      const parsed = JSON.parse(output);
      const vulnerabilities: Record<string, number> = parsed.metadata?.vulnerabilities ?? {};
      const dependencies = parsed.metadata?.dependencies ?? {
        prod: 0,
        dev: 0,
        total: 0,
      };
      await logAudit({
        actorUserId: session.user.id,
        action: "security.npm-audit",
        entity: "system",
        entityId: "npm-audit",
        after: { vulnerabilities, dependencies },
      });
      return {
        ok: true,
        metadata: { vulnerabilities, dependencies },
        ranAt: new Date().toISOString(),
      };
    } catch {
      return {
        error: e.message ?? "npm audit gagal",
        raw: output.slice(0, 500),
      };
    }
  }
}

/**
 * Export audit log ke CSV (30 hari terakhir max 5000 baris).
 * Return CSV string, client tinggal trigger download.
 */
export async function exportAuditLogCsv(): Promise<
  { ok: true; csv: string; count: number } | { error: string }
> {
  await requireRole(["admin"]);
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      actorName: userTable.name,
      actorEmail: userTable.email,
      before: auditLog.before,
      after: auditLog.after,
      meta: auditLog.meta,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(userTable, eq(auditLog.actorUserId, userTable.id))
    .where(gte(auditLog.createdAt, cutoff))
    .orderBy(desc(auditLog.createdAt))
    .limit(5000);

  const header = [
    "id",
    "createdAt",
    "actor",
    "email",
    "action",
    "entity",
    "entityId",
    "meta",
  ];
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.createdAt.toISOString(),
        escape(r.actorName ?? "—"),
        escape(r.actorEmail ?? ""),
        escape(r.action),
        escape(r.entity),
        escape(r.entityId ?? ""),
        escape(r.meta ?? ""),
      ].join(","),
    );
  }

  return { ok: true, csv: lines.join("\n"), count: rows.length };
}

/**
 * Force-close semua session (log semua user keluar).
 * Berguna kalau curiga ada session yang di-hijack.
 */
export async function revokeAllSessions(
  alasan: string,
): Promise<{ ok: true; count: number } | { error: string }> {
  const session = await requireRole(["admin"]);
  const reason = alasan.trim();
  if (reason.length < 3) return { error: "Alasan wajib (min 3 karakter)" };

  const { session: sessionTable } = await import("@/db/schema/auth");
  const before = await db.select({ id: sessionTable.id }).from(sessionTable);
  await db.delete(sessionTable);

  await logAudit({
    actorUserId: session.user.id,
    action: "security.revoke-all-sessions",
    entity: "session",
    entityId: null,
    meta: { alasan: reason, count: before.length },
  });

  return { ok: true, count: before.length };
}

/**
 * Revoke session spesifik.
 */
export async function revokeSession(
  sessionId: string,
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole(["admin"]);
  const { session: sessionTable } = await import("@/db/schema/auth");
  await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));

  await logAudit({
    actorUserId: auth.user.id,
    action: "security.revoke-session",
    entity: "session",
    entityId: sessionId,
  });

  return { ok: true };
}
