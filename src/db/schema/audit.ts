import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/**
 * Audit log untuk telusuri "siapa edit/hapus apa & kapan". Append-only.
 * Pakai logAudit() di action critical (delete/edit harga/void/adjust manual).
 *
 * Field:
 *  - actorUserId: user yang melakukan
 *  - action: nama operasi, kebab-case (mis. "pelanggan.delete", "produk.update-harga")
 *  - entity: nama tabel/resource (mis. "pelanggan", "produk", "transaksi")
 *  - entityId: PK resource (string supaya bisa terima int/uuid)
 *  - before: snapshot data sebelum (JSON string, optional)
 *  - after: snapshot data sesudah (JSON string, optional)
 *  - meta: konteks tambahan (alasan, IP, dll — JSON string)
 */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    before: text("before"),
    after: text("after"),
    meta: text("meta"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    actorIdx: index("audit_log_actor_idx").on(t.actorUserId, t.createdAt),
    entityIdx: index("audit_log_entity_idx").on(t.entity, t.entityId),
    actionIdx: index("audit_log_action_idx").on(t.action),
    createdIdx: index("audit_log_created_idx").on(t.createdAt),
  }),
);

export type AuditLog = typeof auditLog.$inferSelect;
