import { db } from "@/db";
import { auditLog } from "@/db/schema/audit";

export type AuditEntry = {
  actorUserId: string | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
};

/**
 * Tulis 1 baris audit log. Append-only. Aman dipanggil best-effort —
 * kalau gagal, hanya warning (jangan blokir action utama).
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorUserId: entry.actorUserId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId != null ? String(entry.entityId) : null,
      before: entry.before !== undefined ? safeStringify(entry.before) : null,
      after: entry.after !== undefined ? safeStringify(entry.after) : null,
      meta: entry.meta !== undefined ? safeStringify(entry.meta) : null,
    });
  } catch (e) {
    console.warn("[audit] gagal log:", e instanceof Error ? e.message : e);
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, (_k, val) => {
      if (val instanceof Date) return val.toISOString();
      return val;
    });
  } catch {
    return String(v);
  }
}
