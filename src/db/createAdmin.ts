import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { user as userTable } from "./schema/auth";
import { auth } from "../lib/auth";

async function main() {
  const email = process.argv[2] ?? "admin@depot.local";
  const password = process.argv[3] ?? "admin123";
  const nama = process.argv[4] ?? "Admin Depot";

  console.log(`→ Membuat admin: ${email}`);

  const existing = await db.query.user.findFirst({ where: eq(userTable.email, email) });
  if (existing) {
    await db.update(userTable).set({ role: "admin" }).where(eq(userTable.id, existing.id));
    console.log(`✓ User sudah ada — role di-promote ke admin.`);
    console.log(`  Email: ${email}`);
    console.log(`  ID: ${existing.id}`);
    return;
  }

  const result = await auth.api.signUpEmail({
    body: { name: nama, email, password },
  });

  if (!result?.user) throw new Error("Gagal create user via Better Auth");

  await db.update(userTable).set({ role: "admin" }).where(eq(userTable.id, result.user.id));

  console.log(`✓ Admin berhasil dibuat.`);
  console.log(`  Email   : ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Nama    : ${nama}`);
  console.log(`\nLogin di: http://localhost:3000/login`);
}

main().catch((e) => {
  console.error("✗ Gagal:", e);
  process.exit(1);
});
