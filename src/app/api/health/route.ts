import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint untuk monitoring eksternal (UptimeRobot, cron).
 * Return 200 + JSON kalau OK, 503 kalau DB tidak respond.
 *
 * Test: curl https://depot.genster.my.id/api/health
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    // Sanity check: DB respond
    const result = await db.all<{ ok: number }>(sql`SELECT 1 as ok`);
    const dbOk = result.length > 0;

    if (!dbOk) {
      return NextResponse.json(
        {
          status: "unhealthy",
          db: "down",
          uptime: process.uptime(),
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: "ok",
      db: "up",
      uptime: process.uptime(),
      responseMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: e instanceof Error ? e.message : "unknown",
        uptime: process.uptime(),
      },
      { status: 503 },
    );
  }
}
